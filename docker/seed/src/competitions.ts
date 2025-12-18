import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import schema from "@recallnet/db/schema";

import { log } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CompetitionData {
  name: string;
  description: string;
  arenaName: string;
  type: string;
  status: string;
  imageUrl: string;
  externalUrl: string | null;
  startDate: string;
  endDate: string;
  boostStartDate: string | null;
  boostEndDate: string | null;
  joinStartDate: string;
  joinEndDate: string;
  maxParticipants: number;
  minimumStake: string;
  minRecallRank: number | null;
  allowlistOnly: boolean;
  vips: string[];
  allowlist: string[];
  blocklist: string[];
  agentAllocation: string;
  agentAllocationUnit: string;
  boosterAllocation: string;
  boosterAllocationUnit: string;
  boostTimeDecayRate: string;
  rewardRules: any;
  rewardDetails: string;
  sandboxMode: boolean;
  displayState: string;
  tradingConfig?: {
    dataSource?: string;
    evaluationMetric?: string;
    initialCapital?: string;
    selfFundingThresholdUsd?: string;
    minFundingThreshold?: string;
    inactivityHours?: number;
    syncIntervalMinutes?: number;
    chains?: Array<{ specificChain: string; enabled: boolean }>;
    allowedTokens?: Array<{
      specificChain: string;
      tokenAddress: string;
      tokenSymbol: string;
    }>;
    allowedProtocols?: Array<{
      specificChain: string;
      protocol: string;
      routerAddress: string;
      factoryAddress?: string;
    }>;
  };
}

interface ArenaData {
  name: string;
  category: string;
  skill: string;
  venues: string[];
  chains: string[];
  kind: string;
}

/**
 * Load arenas from JSON file
 */
async function loadArenas(): Promise<ArenaData[]> {
  const dataPath = join(__dirname, "..", "data", "arenas.json");
  const content = await readFile(dataPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Load competitions from JSON file
 */
async function loadCompetitions(): Promise<CompetitionData[]> {
  const dataPath = join(__dirname, "..", "data", "competitions.json");
  const content = await readFile(dataPath, "utf-8");
  return JSON.parse(content);
}

/**
 * Seed arenas into the database
 */
export async function seedArenas(
  db: NodePgDatabase<typeof schema>,
): Promise<Map<string, string>> {
  log("Seeding arenas...");

  const arenas = await loadArenas();
  const arenaIdMap = new Map<string, string>();

  for (const arenaData of arenas) {
    try {
      // Check if arena already exists
      const existing = await db
        .select()
        .from(schema.arenas)
        .where(eq(schema.arenas.name, arenaData.name))
        .limit(1);

      if (existing.length > 0) {
        log(`Arena ${arenaData.name} already exists, skipping`, "info");
        arenaIdMap.set(arenaData.name, existing[0].id);
        continue;
      }

      // Insert arena with generated ID
      const arenaId = randomUUID();
      await db.insert(schema.arenas).values({
        id: arenaId,
        name: arenaData.name,
        category: arenaData.category,
        skill: arenaData.skill,
        venues: arenaData.venues,
        chains: arenaData.chains,
        kind: arenaData.kind,
        createdBy: null,
      });

      arenaIdMap.set(arenaData.name, arenaId);
      log(`Created arena: ${arenaData.name}`, "success");
    } catch (error) {
      log(`Failed to create arena ${arenaData.name}: ${error}`, "error");
      throw error;
    }
  }

  log(`Seeded ${arenas.length} arenas`, "success");
  return arenaIdMap;
}

/**
 * Seed competitions into the database
 */
export async function seedCompetitions(
  db: NodePgDatabase<typeof schema>,
  arenaIdMap: Map<string, string>,
): Promise<string[]> {
  log("Seeding competitions...");

  const competitions = await loadCompetitions();
  const competitionIds: string[] = [];

  for (const compData of competitions) {
    try {
      const arenaId = arenaIdMap.get(compData.arenaName);
      if (!arenaId) {
        log(
          `Arena ${compData.arenaName} not found, skipping competition`,
          "error",
        );
        continue;
      }

      // Check if competition already exists
      const existing = await db
        .select()
        .from(schema.competitions)
        .where(eq(schema.competitions.name, compData.name))
        .limit(1);

      if (existing.length > 0) {
        log(`Competition ${compData.name} already exists, skipping`, "info");
        competitionIds.push(existing[0].id);
        continue;
      }

      // Insert competition with generated UUID
      const competitionId = randomUUID();
      await db.insert(schema.competitions).values({
        id: competitionId,
        arenaId: arenaId,
        name: compData.name,
        description: compData.description,
        type: compData.type as any,
        imageUrl: compData.imageUrl,
        externalUrl: compData.externalUrl,
        startDate: new Date(compData.startDate),
        endDate: new Date(compData.endDate),
        boostStartDate: compData.boostStartDate
          ? new Date(compData.boostStartDate)
          : null,
        boostEndDate: compData.boostEndDate
          ? new Date(compData.boostEndDate)
          : null,
        joinStartDate: new Date(compData.joinStartDate),
        joinEndDate: new Date(compData.joinEndDate),
        maxParticipants: compData.maxParticipants,
        registeredParticipants: 0,
        minimumStake: compData.minimumStake,
        minRecallRank: compData.minRecallRank,
        allowlistOnly: compData.allowlistOnly,
        vips: compData.vips,
        allowlist: compData.allowlist,
        blocklist: compData.blocklist,
        agentAllocation: compData.agentAllocation,
        agentAllocationUnit: compData.agentAllocationUnit as any,
        boosterAllocation: compData.boosterAllocation,
        boosterAllocationUnit: compData.boosterAllocationUnit as any,
        boostTimeDecayRate: compData.boostTimeDecayRate,
        rewardRules: compData.rewardRules,
        rewardDetails: compData.rewardDetails,
        status: compData.status as any,
        sandboxMode: compData.sandboxMode,
        displayState: compData.displayState as any,
        engineId: null,
        engineVersion: null,
        rewardsIneligible: [],
      });

      competitionIds.push(competitionId);
      log(`Created competition: ${compData.name}`, "success");

      // Seed trading configuration if present
      if (compData.tradingConfig) {
        await seedTradingConfig(db, competitionId, compData);
      }
    } catch (error) {
      log(`Failed to create competition ${compData.name}: ${error}`, "error");
      throw error;
    }
  }

  log(`Seeded ${competitionIds.length} competitions`, "success");
  return competitionIds;
}

/**
 * Seed trading configuration for a competition
 */
async function seedTradingConfig(
  db: NodePgDatabase<typeof schema>,
  competitionId: string,
  compData: CompetitionData,
): Promise<void> {
  const config = compData.tradingConfig;
  if (!config) return;

  try {
    if (compData.type === "perpetual_futures" && config.dataSource) {
      // Insert perps config
      await db.insert(schema.perpsCompetitionConfig).values({
        competitionId: competitionId,
        dataSource: config.dataSource as any,
        dataSourceConfig: {},
        evaluationMetric: config.evaluationMetric as any,
        initialCapital: config.initialCapital || "10000",
        selfFundingThresholdUsd: config.selfFundingThresholdUsd || "1000",
        minFundingThreshold: config.minFundingThreshold || "100",
        inactivityHours: config.inactivityHours || 72,
      });
      log(`Created perps config for competition ${competitionId}`, "success");
    } else if (compData.type === "spot_live_trading") {
      // Insert spot live config
      await db.insert(schema.spotLiveCompetitionConfig).values({
        competitionId: competitionId,
        dataSource: (config.dataSource as any) || "onchain",
        dataSourceConfig: {},
        selfFundingThresholdUsd: config.selfFundingThresholdUsd || "500",
        minFundingThreshold: config.minFundingThreshold || "50",
        inactivityHours: config.inactivityHours || 48,
        syncIntervalMinutes: config.syncIntervalMinutes || 5,
      });

      // Insert chains
      if (config.chains) {
        for (const chain of config.chains) {
          await db.insert(schema.spotLiveCompetitionChains).values({
            competitionId: competitionId,
            specificChain: chain.specificChain,
            enabled: chain.enabled,
          });
        }
      }

      // Insert allowed tokens
      if (config.allowedTokens) {
        for (const token of config.allowedTokens) {
          await db.insert(schema.spotLiveAllowedTokens).values({
            competitionId: competitionId,
            specificChain: token.specificChain,
            tokenAddress: token.tokenAddress,
            tokenSymbol: token.tokenSymbol,
          });
        }
      }

      // Insert allowed protocols
      if (config.allowedProtocols) {
        for (const protocol of config.allowedProtocols) {
          await db.insert(schema.spotLiveAllowedProtocols).values({
            competitionId: competitionId,
            specificChain: protocol.specificChain,
            protocol: protocol.protocol,
            routerAddress: protocol.routerAddress,
            factoryAddress: protocol.factoryAddress,
            swapEventSignature: "0x", // Default empty signature
          });
        }
      }

      log(
        `Created spot live config for competition ${competitionId}`,
        "success",
      );
    }

    // Insert trading competition entry
    await db.insert(schema.tradingCompetitions).values({
      competitionId: competitionId,
      crossChainTradingType: compData.arenaName.includes("Cross-Chain")
        ? "allow"
        : "disallowAll",
    });
  } catch (error) {
    log(
      `Failed to create trading config for competition ${competitionId}: ${error}`,
      "error",
    );
    // Don't throw - config is optional
  }
}

/**
 * Enroll agents in competitions
 * - Agents 0-6 enrolled in finished competition (Winter Perpetuals)
 * - Agents 0-10 enrolled in active competitions (Spring Spot, Cross-Chain)
 * - Agents 7-13 left for manual enrollment
 */
export async function enrollAgentsInCompetitions(
  db: NodePgDatabase<typeof schema>,
  agentIds: string[],
  competitionIds: string[],
): Promise<void> {
  log("Enrolling agents in competitions...");

  // Get competition details
  const competitions = await db
    .select()
    .from(schema.competitions)
    .where(eq(schema.competitions.id, competitionIds[0]));

  const competitionsByName = new Map<string, string>();
  for (const compId of competitionIds) {
    const [comp] = await db
      .select()
      .from(schema.competitions)
      .where(eq(schema.competitions.id, compId))
      .limit(1);

    if (comp) {
      competitionsByName.set(comp.name, comp.id);
    }
  }

  const enrollmentPlan = [
    {
      competition: "Winter Perpetuals Championship",
      agentIndexes: [0, 1, 2, 3, 4, 5, 6], // 7 agents in finished comp
      status: "active" as const,
    },
    {
      competition: "Spring Spot Trading Challenge",
      agentIndexes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], // 10 agents in active comp
      status: "active" as const,
    },
    {
      competition: "Cross-Chain Masters Series",
      agentIndexes: [2, 3, 4, 8, 9, 10], // 6 agents in active elite comp
      status: "active" as const,
    },
  ];

  for (const plan of enrollmentPlan) {
    const competitionId = competitionsByName.get(plan.competition);
    if (!competitionId) {
      log(
        `Competition ${plan.competition} not found, skipping enrollment`,
        "error",
      );
      continue;
    }

    for (const agentIndex of plan.agentIndexes) {
      if (agentIndex >= agentIds.length) {
        continue;
      }

      const agentId = agentIds[agentIndex];

      try {
        // Check if already enrolled
        const existing = await db
          .select()
          .from(schema.competitionAgents)
          .where(
            and(
              eq(schema.competitionAgents.competitionId, competitionId),
              eq(schema.competitionAgents.agentId, agentId),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          log(
            `Agent ${agentId} already enrolled in ${plan.competition}, skipping`,
            "info",
          );
          continue;
        }

        // Enroll agent
        await db.insert(schema.competitionAgents).values({
          competitionId: competitionId,
          agentId: agentId,
          status: plan.status,
          deactivationReason: null,
          deactivatedAt: null,
        });

        log(`Enrolled agent ${agentId} in ${plan.competition}`, "success");
      } catch (error) {
        log(
          `Failed to enroll agent ${agentId} in ${plan.competition}: ${error}`,
          "error",
        );
        // Continue with other enrollments
      }
    }
  }

  log("Agent enrollment complete", "success");
}
