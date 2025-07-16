import { z } from "zod/v4";

/**
 * Query schema for email verification endpoint.
 * @example { token: "verification-token-string" }
 */
export const EmailVerificationQuerySchema = z.object({
  token: z.string().min(1, "Token is required"),
});
