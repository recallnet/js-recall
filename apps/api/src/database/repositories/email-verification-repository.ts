import { eq } from "drizzle-orm";

import { db } from "@/database/db.js";
import { emailVerificationTokens } from "@/database/schema/core/defs.js";

/**
 * Creates a new email verification token
 * @param token The token data to insert
 * @returns The inserted token
 */
export async function createEmailVerificationToken(token: {
  id: string;
  userId?: string;
  agentId?: string;
  token: string;
  expiresAt: Date;
}): Promise<typeof emailVerificationTokens.$inferSelect> {
  const [insertedToken] = await db
    .insert(emailVerificationTokens)
    .values(token)
    .returning();

  if (!insertedToken) {
    throw new Error("Failed to create email verification token");
  }

  return insertedToken;
}

/**
 * Finds an email verification token by its token string
 * @param tokenString The token string to search for
 * @returns The token if found, undefined otherwise
 */
export async function findEmailVerificationTokenByToken(
  tokenString: string,
): Promise<typeof emailVerificationTokens.$inferSelect | undefined> {
  const tokens = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, tokenString))
    .limit(1);

  return tokens[0];
}

/**
 * Marks a token as used
 * @param tokenId The ID of the token to mark as used
 * @returns The updated token
 */
export async function markTokenAsUsed(
  tokenId: string,
): Promise<typeof emailVerificationTokens.$inferSelect | undefined> {
  const [updatedToken] = await db
    .update(emailVerificationTokens)
    .set({ used: true })
    .where(eq(emailVerificationTokens.id, tokenId))
    .returning();

  return updatedToken;
}
