import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import schema from "@recallnet/db/schema";

import {
  generateApiKey,
  generateHandle,
  generateRandomEthAddress,
  hashApiKey,
  log,
} from "./utils.js";

export interface AgentSeedData {
  ownerId: string;
  name: string;
  handle: string;
  email: string;
  description: string;
  walletAddress: string;
  apiKey: string;
}

/**
 * Generate agent data for a user
 * Each agent gets a unique random wallet address
 */
export function generateAgentData(
  userId: string,
  userIndex: number,
): AgentSeedData[] {
  const agentTemplates = [
    {
      name: "Alpha Bot",
      description:
        "High-frequency trading bot specializing in arbitrage opportunities across DEXs.",
    },
    {
      name: "Momentum Trader",
      description:
        "Trend-following strategy with dynamic position sizing based on market volatility.",
    },
    {
      name: "Market Maker",
      description:
        "Provides liquidity and captures spread in volatile trading pairs.",
    },
  ];

  // Users 0-5 get 2 agents, users 6-9 get 1 agent
  const agentCount = userIndex < 6 ? 2 : 1;

  return agentTemplates.slice(0, agentCount).map((template, index) => {
    return {
      ownerId: userId,
      name: `${template.name} ${userIndex}`,
      handle: generateHandle(`${template.name}-${userIndex}-${index}`),
      email: `agent-${userIndex}-${index}@recall.local`,
      description: template.description,
      walletAddress: generateRandomEthAddress(),
      apiKey: generateApiKey(),
    };
  });
}

/**
 * Seed agents into the database
 */
export async function seedAgents(
  db: NodePgDatabase<typeof schema>,
  userIds: string[],
): Promise<string[]> {
  log("Seeding agents...");

  const agentIds: string[] = [];

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];

    // Get user info
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      log(`User ${userId} not found, skipping agents`, "error");
      continue;
    }

    const agents = generateAgentData(userId, i);

    for (const agentData of agents) {
      try {
        // Check if agent already exists (by owner and name)
        const existing = await db
          .select()
          .from(schema.agents)
          .where(
            and(
              eq(schema.agents.ownerId, agentData.ownerId),
              eq(schema.agents.name, agentData.name),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          log(`Agent ${agentData.name} already exists, skipping`, "info");
          agentIds.push(existing[0].id);
          continue;
        }

        // Insert agent with generated UUID
        const agentId = randomUUID();
        await db.insert(schema.agents).values({
          id: agentId,
          ownerId: agentData.ownerId,
          walletAddress: agentData.walletAddress,
          name: agentData.name,
          handle: agentData.handle,
          email: agentData.email,
          description: agentData.description,
          apiKey: agentData.apiKey,
          apiKeyHash: hashApiKey(agentData.apiKey),
          status: "active",
          metadata: {},
          isRewardsIneligible: false,
        });

        agentIds.push(agentId);

        log(
          `Created agent: ${agentData.name} (${agentData.handle}) - API Key: ${agentData.apiKey}`,
          "success",
        );
      } catch (error) {
        log(`Failed to create agent ${agentData.name}: ${error}`, "error");
        throw error;
      }
    }
  }

  log(`Seeded ${agentIds.length} agents`, "success");
  return agentIds;
}

/**
 * Get all seeded agent IDs
 */
export async function getSeededAgentIds(
  db: NodePgDatabase<typeof schema>,
): Promise<string[]> {
  const agents = await db
    .select({ id: schema.agents.id })
    .from(schema.agents)
    .orderBy(schema.agents.id);

  return agents.map((a) => a.id);
}
