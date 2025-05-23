import { and, count as drizzleCount, eq, ilike } from "drizzle-orm";

import { db } from "@/database/db.js";
import { agents, competitionAgents } from "@/database/schema/core/defs.js";
import { InsertAgent, SelectAgent } from "@/database/schema/core/types.js";
import { AgentSearchParams } from "@/types/index.js";

import { PartialExcept } from "./types.js";

/**
 * Agent Repository
 * Handles database operations for agents
 */

/**
 * Create a new agent
 * @param agent Agent to create
 */
export async function create(agent: InsertAgent): Promise<SelectAgent> {
  try {
    const now = new Date();
    const [result] = await db
      .insert(agents)
      .values({
        ...agent,
        createdAt: agent.createdAt || now,
        updatedAt: agent.updatedAt || now,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create agent - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in create:", error);
    throw error;
  }
}

/**
 * Find all agents
 */
export async function findAll(): Promise<SelectAgent[]> {
  try {
    return await db.select().from(agents);
  } catch (error) {
    console.error("[AgentRepository] Error in findAll:", error);
    throw error;
  }
}

/**
 * Find an agent by ID
 * @param id Agent ID to find
 */
export async function findById(id: string): Promise<SelectAgent | undefined> {
  try {
    const [result] = await db.select().from(agents).where(eq(agents.id, id));
    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in findById:", error);
    throw error;
  }
}

/**
 * Find agents by owner ID
 * @param ownerId Owner ID to search for
 */
export async function findByOwnerId(ownerId: string): Promise<SelectAgent[]> {
  try {
    return await db.select().from(agents).where(eq(agents.ownerId, ownerId));
  } catch (error) {
    console.error("[AgentRepository] Error in findByOwnerId:", error);
    throw error;
  }
}

/**
 * Find an agent by API key
 * @param apiKey The API key to search for
 */
export async function findByApiKey(
  apiKey: string,
): Promise<SelectAgent | undefined> {
  try {
    const [result] = await db
      .select()
      .from(agents)
      .where(eq(agents.apiKey, apiKey));

    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in findByApiKey:", error);
    throw error;
  }
}

/**
 * Update an agent
 * @param agent Agent data to update (must include id)
 */
export async function update(
  agent: PartialExcept<InsertAgent, "id">,
): Promise<SelectAgent> {
  try {
    const now = new Date();
    const [result] = await db
      .update(agents)
      .set({
        ...agent,
        updatedAt: now,
      })
      .where(eq(agents.id, agent.id))
      .returning();

    if (!result) {
      throw new Error("Failed to update agent - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in update:", error);
    throw error;
  }
}

/**
 * Delete an agent by ID
 * @param id Agent ID to delete
 * @returns true if agent was deleted, false otherwise
 */
export async function deleteAgent(id: string): Promise<boolean> {
  try {
    const [result] = await db
      .delete(agents)
      .where(eq(agents.id, id))
      .returning();

    return !!result;
  } catch (error) {
    console.error("[AgentRepository] Error in delete:", error);
    throw error;
  }
}

/**
 * Check if an agent exists in a competition
 * @param agentId Agent ID
 * @param competitionId Competition ID
 */
export async function isAgentInCompetition(
  agentId: string,
  competitionId: string,
): Promise<boolean> {
  try {
    const [result] = await db
      .select({ count: drizzleCount() })
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.agentId, agentId),
          eq(competitionAgents.competitionId, competitionId),
        ),
      )
      .limit(1);

    return !!result?.count;
  } catch (error) {
    console.error("[AgentRepository] Error in isAgentInCompetition:", error);
    throw error;
  }
}

/**
 * Deactivate an agent with a reason
 * @param agentId Agent ID to deactivate
 * @param reason Reason for deactivation
 */
export async function deactivateAgent(
  agentId: string,
  reason: string,
): Promise<SelectAgent> {
  try {
    const now = new Date();
    const [result] = await db
      .update(agents)
      .set({
        status: "suspended",
        metadata: { deactivationReason: reason, deactivationDate: now },
        updatedAt: now,
      })
      .where(eq(agents.id, agentId))
      .returning();

    if (!result) {
      throw new Error("Failed to deactivate agent - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in deactivateAgent:", error);
    throw error;
  }
}

/**
 * Reactivate an agent
 * @param agentId Agent ID to reactivate
 */
export async function reactivateAgent(agentId: string): Promise<SelectAgent> {
  try {
    const now = new Date();
    const [result] = await db
      .update(agents)
      .set({
        status: "active",
        updatedAt: now,
      })
      .where(eq(agents.id, agentId))
      .returning();

    if (!result) {
      throw new Error("Failed to reactivate agent - no result returned");
    }

    return result;
  } catch (error) {
    console.error("[AgentRepository] Error in reactivateAgent:", error);
    throw error;
  }
}

/**
 * Search for agents by various attributes
 * @param searchParams Object containing search parameters
 * @returns Array of agents matching the search criteria
 */
export async function searchAgents(
  searchParams: AgentSearchParams,
): Promise<SelectAgent[]> {
  try {
    const conditions = [];

    // Add filters for each provided parameter
    if (searchParams.name) {
      conditions.push(ilike(agents.name, `%${searchParams.name}%`));
    }

    if (searchParams.ownerId) {
      conditions.push(eq(agents.ownerId, searchParams.ownerId));
    }

    if (searchParams.status) {
      conditions.push(eq(agents.status, searchParams.status));
    }

    // If no search parameters were provided, return all agents
    if (conditions.length === 0) {
      return await db.select().from(agents);
    }

    // Combine all conditions with AND operator
    return await db
      .select()
      .from(agents)
      .where(and(...conditions));
  } catch (error) {
    console.error("[AgentRepository] Error in searchAgents:", error);
    throw error;
  }
}

/**
 * Count all agents
 */
export async function count(): Promise<number> {
  try {
    const [result] = await db.select({ count: drizzleCount() }).from(agents);
    return result?.count ?? 0;
  } catch (error) {
    console.error("[AgentRepository] Error in count:", error);
    throw error;
  }
}

/**
 * Find all inactive agents
 */
export async function findInactiveAgents(): Promise<SelectAgent[]> {
  try {
    return await db.select().from(agents).where(eq(agents.status, "suspended"));
  } catch (error) {
    console.error("[AgentRepository] Error in findInactiveAgents:", error);
    throw error;
  }
}
