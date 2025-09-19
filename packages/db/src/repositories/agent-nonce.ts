import { eq, lt } from "drizzle-orm";

import { agentNonces } from "../schema/core/defs.js";
import { Database } from "../types.js";

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

export class AgentNonceRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  /**
   * Create a new agent nonce
   * @param nonce The nonce data to insert
   * @returns The created nonce record
   */
  async create(nonce: InsertAgentNonce): Promise<SelectAgentNonce> {
    const [created] = await this.#db
      .insert(agentNonces)
      .values(nonce)
      .returning();
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
  async findByNonce(nonce: string): Promise<SelectAgentNonce | undefined> {
    const [found] = await this.#db
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
  async markAsUsed(nonce: string): Promise<void> {
    await this.#db
      .update(agentNonces)
      .set({ usedAt: new Date() })
      .where(eq(agentNonces.nonce, nonce));
  }

  /**
   * Delete expired nonces
   * @returns The number of deleted records
   */
  async deleteExpired(): Promise<number> {
    const result = await this.#db
      .delete(agentNonces)
      .where(lt(agentNonces.expiresAt, new Date()));
    return result.rowCount || 0;
  }

  /**
   * Delete all nonces for an agent
   * @param agentId The agent ID whose nonces to delete
   */
  async deleteByAgentId(agentId: string): Promise<void> {
    await this.#db.delete(agentNonces).where(eq(agentNonces.agentId, agentId));
  }
}
