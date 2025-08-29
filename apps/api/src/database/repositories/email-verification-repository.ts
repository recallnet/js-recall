import { eq } from "drizzle-orm";

import { emailVerificationTokens } from "@recallnet/db-schema/core/defs";
import {
  InsertEmailVerificationToken,
  SelectEmailVerificationToken,
} from "@recallnet/db-schema/core/types";

import { db } from "@/database/db.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

/**
 * Creates a new email verification token
 * @param token The token data to insert
 * @returns The inserted token
 */
async function createEmailVerificationTokenImpl(
  token: InsertEmailVerificationToken,
): Promise<SelectEmailVerificationToken> {
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
async function findEmailVerificationTokenByTokenImpl(
  tokenString: string,
): Promise<SelectEmailVerificationToken | undefined> {
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
async function markTokenAsUsedImpl(
  tokenId: string,
): Promise<SelectEmailVerificationToken | undefined> {
  const [updatedToken] = await db
    .update(emailVerificationTokens)
    .set({ used: true })
    .where(eq(emailVerificationTokens.id, tokenId))
    .returning();

  return updatedToken;
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

export const createEmailVerificationToken = createTimedRepositoryFunction(
  createEmailVerificationTokenImpl,
  "EmailVerificationRepository",
  "createEmailVerificationToken",
);

export const findEmailVerificationTokenByToken = createTimedRepositoryFunction(
  findEmailVerificationTokenByTokenImpl,
  "EmailVerificationRepository",
  "findEmailVerificationTokenByToken",
);

export const markTokenAsUsed = createTimedRepositoryFunction(
  markTokenAsUsedImpl,
  "EmailVerificationRepository",
  "markTokenAsUsed",
);
