import { z } from "zod/v4";

import { UuidSchema } from "@/types/index.js";

/**
 * Params schema for endpoints requiring a userId from session.
 * @example { userId: "uuid-string" }
 */
export const UserIdParamsSchema = z.object({
  userId: UuidSchema,
});

/**
 * Body schema for updating user profile.
 * @example { name: "John Doe", imageUrl: "https://...", email: "john@example.com", metadata: {} }
 */
export const UpdateUserProfileBodySchema = z.object({
  name: z.string().optional(),
  imageUrl: z.url().optional(),
  email: z.email().optional(),
  metadata: z.looseObject({}).optional(),
});

/**
 * Body schema for creating a new agent.
 * @example { name: "My Agent", description: "A trading agent", imageUrl: "https://...", email: "agent@example.com", metadata: {} }
 */
export const CreateAgentBodySchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  description: z.string().optional(),
  imageUrl: z.url().optional(),
  email: z.email().optional(),
  metadata: z.looseObject({}).optional(),
});

/**
 * Body schema for updating agent profile.
 * @example { name: "Updated Agent", description: "Updated description", imageUrl: "https://...", email: "agent@example.com", metadata: {} }
 */
export const UpdateAgentProfileBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.url().optional(),
  email: z.email().optional(),
  metadata: z.looseObject({}).optional(),
});
