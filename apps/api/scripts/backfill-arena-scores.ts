import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import * as path from "path";

import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { ArenaRepository } from "@recallnet/db/repositories/arena";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { agentScore } from "@recallnet/db/schema/ranking/defs";
import { InsertAgentScore } from "@recallnet/db/schema/ranking/types";

import { db, dbRead } from "@/database/db.js";
import { createLogger } from "@/lib/logger.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("BackfillArenaScores");
const agentScoreRepo = new AgentScoreRepository(db, logger);
const arenaRepo = new ArenaRepository(db, dbRead, logger);
const competitionRepo = new CompetitionRepository(db, dbRead, logger);

/**
 * Backfill arena-specific scores for existing competitions
 *
 * For each arena:
 * 1. Gets all ended competitions in that arena
 * 2. Gets all agents who competed in those competitions
 * 3. Uses historical data to determine final arena score per agent
 * 4. Inserts arena-specific scores
 *
 * Safe to run multiple times (uses ON CONFLICT DO NOTHING)
 */
async function backfillArenaScores(): Promise<void> {
  logger.info("Starting arena scores backfill...");

  try {
    // Get all arenas using repository
    const { arenas: allArenas } = await arenaRepo.findAll(
      { limit: 100, offset: 0, sort: "" },
      undefined,
    );

    logger.info(`Found ${allArenas.length} arenas to process`);

    let totalScoresCreated = 0;

    // Process each arena
    for (const arena of allArenas) {
      logger.info(`\nProcessing arena: ${arena.id} (${arena.name})`);

      // Get all ended competitions in this arena using repository
      const { competitions: arenaCompetitions } =
        await competitionRepo.findByArenaId(arena.id, {
          limit: 1000, // Large limit to get all competitions
          offset: 0,
          sort: "",
        });

      // Filter to ended competitions only
      const endedCompetitions = arenaCompetitions.filter(
        (c) => c.status === "ended",
      );

      if (endedCompetitions.length === 0) {
        logger.info(`  Skipping arena ${arena.id} - no ended competitions`);
        continue;
      }

      logger.info(
        `  Found ${endedCompetitions.length} ended competitions in arena`,
      );

      // Get unique agent IDs from all competitions in this arena using repository
      const agentIdsSet = new Set<string>();
      for (const comp of endedCompetitions) {
        const agentIds = await competitionRepo.getAllCompetitionAgents(comp.id);
        agentIds.forEach((id) => agentIdsSet.add(id));
      }

      const uniqueAgentIds = Array.from(agentIdsSet);
      logger.info(`  Found ${uniqueAgentIds.length} unique agents in arena`);

      if (uniqueAgentIds.length === 0) {
        logger.info(`  Skipping arena ${arena.id} - no agents found`);
        continue;
      }

      // Check which agents already have arena scores (for idempotency)
      const existingScores = await db
        .select({ agentId: agentScore.agentId })
        .from(agentScore)
        .where(eq(agentScore.arenaId, arena.id));
      const existingAgentIds = new Set(existingScores.map((s) => s.agentId));

      const agentsToBackfill = uniqueAgentIds.filter(
        (id) => !existingAgentIds.has(id),
      );

      if (agentsToBackfill.length === 0) {
        logger.info(
          `  Skipping arena ${arena.id} - all agents already have arena scores`,
        );
        continue;
      }

      logger.info(
        `  Backfilling ${agentsToBackfill.length} agents (${existingAgentIds.size} already exist)`,
      );

      // Get complete arena history using repository
      const arenaHistory = await agentScoreRepo.getHistoryForArena(arena.id);

      if (arenaHistory.length === 0) {
        logger.warn(
          `  Warning: No history found for arena ${arena.id}, skipping`,
        );
        continue;
      }

      logger.info(`  Retrieved ${arenaHistory.length} history entries`);

      // Process agents in batches to avoid memory issues
      const BATCH_SIZE = 50;
      for (let i = 0; i < agentsToBackfill.length; i += BATCH_SIZE) {
        const batchAgentIds = agentsToBackfill.slice(i, i + BATCH_SIZE);
        const batchScores: InsertAgentScore[] = [];

        for (const agentId of batchAgentIds) {
          // Get agent's history in this arena, sorted chronologically
          const agentHistory = arenaHistory
            .filter((h) => h.agentId === agentId)
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            );

          if (agentHistory.length === 0) {
            logger.debug(`    Skipping agent ${agentId} - no history in arena`);
            continue;
          }

          // Use the latest historical rating as final arena score
          const latestHistory = agentHistory[agentHistory.length - 1]!;

          // Map arena skill to competition type enum
          const competitionType =
            arena.skill === "spot_paper_trading" ? "trading" : arena.skill;

          batchScores.push({
            id: crypto.randomUUID(),
            agentId,
            type: competitionType as "trading" | "perpetual_futures",
            arenaId: arena.id,
            mu: latestHistory.mu,
            sigma: latestHistory.sigma,
            ordinal: latestHistory.ordinal,
          });
        }

        if (batchScores.length > 0) {
          // Insert batch using repository method with db transaction
          await db.transaction(async (tx) => {
            await agentScoreRepo.batchUpsertArenaScores(
              tx,
              batchScores,
              arena.id,
            );
          });

          totalScoresCreated += batchScores.length;
          logger.info(
            `    ✓ Inserted ${batchScores.length} arena scores for batch`,
          );
        }
      }

      logger.info(`  ✓ Completed arena ${arena.id}`);
    }

    logger.info(`\n✅ Backfill complete!`);
    logger.info(`  Total arena scores created: ${totalScoresCreated}`);
    logger.info(`  Processed ${allArenas.length} arenas`);
    process.exit(0);
  } catch (error) {
    logger.error("Error during backfill:", error);
    process.exit(1);
  }
}

backfillArenaScores();
