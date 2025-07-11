import { eq, lt } from "drizzle-orm";

import { db } from "@/database/db.js";
import { agentNonces } from "@/database/schema/core/defs.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";

export interface InsertAgentNonce {
  id: string;
  agentId: string;
  nonce: string;
  expiresAt: Date;
  createdAt?: Date;
  usedAt?: Date;
}

export interface SelectAgentNonce {
  id: string;
  agentId: string;
  nonce: string;
  expiresAt: Date;
  createdAt: Date;
  usedAt: Date | null;
}

/**
 * Create a new agent nonce
 * @param nonce The nonce data to insert
 * @returns The created nonce record
 */
async function createImpl(nonce: InsertAgentNonce): Promise<SelectAgentNonce> {
  const [created] = await db.insert(agentNonces).values(nonce).returning();
  if (!created) {
    throw new Error("Failed to create agent nonce");
  }
  return created;
}

/**
 * Find an agent nonce by nonce value
 * @param nonce The nonce string to search for
 * @returns The nonce record if found, undefined otherwise
 */
async function findByNonceImpl(
  nonce: string,
): Promise<SelectAgentNonce | undefined> {
  const [found] = await db
    .select()
    .from(agentNonces)
    .where(eq(agentNonces.nonce, nonce))
    .limit(1);
  return found;
}

/**
 * Mark a nonce as used
 * @param nonce The nonce string to mark as used
 */
async function markAsUsedImpl(nonce: string): Promise<void> {
  await db
    .update(agentNonces)
    .set({ usedAt: new Date() })
    .where(eq(agentNonces.nonce, nonce));
}

/**
 * Delete expired nonces
 * @returns The number of deleted records
 */
async function deleteExpiredImpl(): Promise<number> {
  const result = await db
    .delete(agentNonces)
    .where(lt(agentNonces.expiresAt, new Date()));
  return result.rowCount || 0;
}

/**
 * Delete all nonces for an agent
 * @param agentId The agent ID whose nonces to delete
 */
async function deleteByAgentIdImpl(agentId: string): Promise<void> {
  await db.delete(agentNonces).where(eq(agentNonces.agentId, agentId));
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

export const create = createTimedRepositoryFunction(
  createImpl,
  "AgentNonceRepository",
  "create",
);

export const findByNonce = createTimedRepositoryFunction(
  findByNonceImpl,
  "AgentNonceRepository",
  "findByNonce",
);

export const markAsUsed = createTimedRepositoryFunction(
  markAsUsedImpl,
  "AgentNonceRepository",
  "markAsUsed",
);

export const deleteExpired = createTimedRepositoryFunction(
  deleteExpiredImpl,
  "AgentNonceRepository",
  "deleteExpired",
);

export const deleteByAgentId = createTimedRepositoryFunction(
  deleteByAgentIdImpl,
  "AgentNonceRepository",
  "deleteByAgentId",
);
