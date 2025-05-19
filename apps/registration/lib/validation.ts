import { z } from "zod";

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .min(1, { message: "Email is required" })
  .email({ message: "Invalid email address" });

/**
 * Wallet address validation schema
 */
export const walletAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
  message:
    "Invalid wallet address, must start with 0x followed by 40 hex characters",
});

/**
 * Agent skill validation schema
 */
export const agentSkillSchema = z.object({
  type: z.string(),
  customSkill: z.string().optional(),
});

/**
 * Agent social validation schema
 */
export const agentSocialSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).optional(),
  twitter: z.string().optional(),
  github: z.string().optional(),
  discord: z.string().optional(),
  telegram: z.string().optional(),
});

/**
 * Agent validation schema
 */
export const agentSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  url: z.string().url({ message: "Must be a valid URL" }).optional(),
  description: z.string().optional(),
  skills: z.array(agentSkillSchema).optional(),
  social: agentSocialSchema.optional(),
});

/**
 * Complete registration form validation schema
 */
export const registrationSchema = z.object({
  teamName: z.string().min(1, { message: "Team name is required" }),
  contactPerson: z.string().min(1, { message: "Contact person is required" }),
  email: emailSchema,
  walletAddress: walletAddressSchema,
  agents: z.array(agentSchema).optional(),
});
