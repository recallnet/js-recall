import { z } from "zod/v4";

/**
 * Login request body schema
 * @example { message: "SIWE message", signature: "0x..." }
 */
export const LoginBodySchema = z.object({
  message: z.string().min(1, "Message is required"),
  signature: z.string().min(1, "Signature is required"),
});

/**
 * Agent wallet verification request body schema
 * @example { message: "Custom message", signature: "0x..." }
 */
export const VerifyAgentWalletBodySchema = z.object({
  message: z.string().min(1, "Message is required"),
  signature: z.string().min(1, "Signature is required"),
});
