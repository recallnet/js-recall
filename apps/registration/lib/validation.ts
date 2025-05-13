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
export const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, {
    message:
      "Invalid wallet address, must start with 0x followed by 40 hex characters",
  })
  .optional()
  .or(z.literal(""));

/**
 * Agent metadata validation schema
 */
export const metadataSchema = z
  .object({
    ref: z
      .object({
        name: z
          .string()
          .min(1, { message: "Agent name is required" })
          .optional(),
        version: z.string().optional(),
        url: z.string().url({ message: "Must be a valid URL" }).optional(),
      })
      .optional(),
    description: z.string().optional(),
    social: z
      .object({
        name: z.string().optional(),
        email: z
          .string()
          .email({ message: "Invalid email address" })
          .optional(),
        twitter: z.string().optional(),
      })
      .optional(),
  })
  .optional();

/**
 * Complete registration form validation schema
 */
export const registrationSchema = z.object({
  teamName: z.string().min(1, { message: "Team name is required" }),
  email: emailSchema,
  contactPerson: z.string().min(1, { message: "Contact person is required" }),
  walletAddress: walletAddressSchema,
  metadata: metadataSchema,
});
