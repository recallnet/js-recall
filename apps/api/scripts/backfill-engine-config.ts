import * as dotenv from "dotenv";
import { eq, isNotNull, isNull, sql } from "drizzle-orm";
import * as path from "path";

import { arenas, competitions } from "@recallnet/db/schema/core/defs";
import {
  perpsCompetitionConfig,
  tradingCompetitions,
  tradingConstraints,
} from "@recallnet/db/schema/trading/defs";

import { db } from "@/database/db.js";
import { createLogger } from "@/lib/logger.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("BackfillArenas");

/**
 * Backfill arenas and engine configuration for existing competitions
 *
 * Creates:
 * - 5 production arenas based on competition themes and providers
 * - Populates competitions with engineId, engineVersion, arena_id
 *
 * Safe to run multiple times (idempotent - skips already backfilled)
 */
async function backfillArenasAndEngineConfig(): Promise<void> {
  logger.info("Starting arena and engine config backfill...");

  try {
    // ========================================
    // 1. Create Production Arenas
    // ========================================
    logger.info("Creating production arenas...");

    const productionArenas = [
      {
        id: "open-paper-trading",
        name: "Open Paper Trading",
        createdBy: "system",
        category: "crypto_trading",
        skill: "spot_paper_trading",
        venues: null,
        chains: ["eth", "polygon", "base", "arbitrum", "optimism", "svm"],
      },
      {
        id: "evm-paper-trading",
        name: "EVM Paper Trading",
        createdBy: "system",
        category: "crypto_trading",
        skill: "spot_paper_trading",
        venues: null,
        chains: ["eth", "polygon", "base", "arbitrum", "optimism"],
      },
      {
        id: "chain-battles",
        name: "Chain Battles",
        createdBy: "system",
        category: "crypto_trading",
        skill: "spot_paper_trading",
        venues: null,
        chains: null,
      },
      {
        id: "hyperliquid-perps",
        name: "Perpetual Futures on Hyperliquid",
        createdBy: "system",
        category: "crypto_trading",
        skill: "perpetual_futures",
        venues: ["hyperliquid"],
        chains: null,
      },
      {
        id: "symphony-perps",
        name: "Perpetual Futures on Symphony",
        createdBy: "system",
        category: "crypto_trading",
        skill: "perpetual_futures",
        venues: ["symphony"],
        chains: null,
      },
    ];

    for (const arena of productionArenas) {
      await db.insert(arenas).values(arena).onConflictDoNothing().execute();
      logger.debug(`Created/verified arena: ${arena.id}`);
    }

    logger.info("✓ Production arenas created");

    // ========================================
    // 2. Backfill Paper Trading Competitions
    // ========================================
    logger.info("Backfilling paper trading competitions...");

    const paperCompetitions = await db
      .select({
        id: competitions.id,
        name: competitions.name,
        crossChainTradingType: tradingCompetitions.crossChainTradingType,
        minimumPairAgeHours: tradingConstraints.minimumPairAgeHours,
        minimum24hVolumeUsd: tradingConstraints.minimum24hVolumeUsd,
        minimumLiquidityUsd: tradingConstraints.minimumLiquidityUsd,
        minimumFdvUsd: tradingConstraints.minimumFdvUsd,
        minTradesPerDay: tradingConstraints.minTradesPerDay,
      })
      .from(competitions)
      .innerJoin(
        tradingCompetitions,
        eq(competitions.id, tradingCompetitions.competitionId),
      )
      .leftJoin(
        tradingConstraints,
        eq(competitions.id, tradingConstraints.competitionId),
      )
      .where(eq(competitions.type, "trading"));

    logger.info(`Found ${paperCompetitions.length} paper trading competitions`);

    let paperUpdated = 0;
    for (const comp of paperCompetitions) {
      // Skip if already backfilled
      const existing = await db
        .select({ engineId: competitions.engineId })
        .from(competitions)
        .where(eq(competitions.id, comp.id))
        .limit(1);

      if (existing[0]?.engineId) {
        logger.debug(`Skipping ${comp.name} (already backfilled)`);
        continue;
      }

      // Determine arena based on competition name and purpose
      let arenaId: string;

      if (comp.name === "Ethereum Paper Trading Challenge") {
        // EVM-only DevConnect week competition
        arenaId = "evm-paper-trading";
      } else if (comp.name === "ETH v SOL") {
        // Ecosystem battle (EVM vs SVM showdown)
        arenaId = "chain-battles";
      } else {
        // Generic multi-chain competitions and partnership events
        // Includes: Paper Trading Competition, Crypto Trading Competition/Challenge,
        //           AlphaWave, Autonomous Apes Hackathon Finale
        arenaId = "open-paper-trading";
      }

      await db
        .update(competitions)
        .set({
          arenaId,
          engineId: "spot_paper_trading",
          engineVersion: "1.0.0",
        })
        .where(eq(competitions.id, comp.id));

      paperUpdated++;
      logger.debug(`Updated ${comp.name} → ${arenaId}`);
    }

    logger.info(`✓ Backfilled ${paperUpdated} paper trading competitions`);

    // ========================================
    // 3. Backfill Perpetual Futures Competitions
    // ========================================
    logger.info("Backfilling perpetual futures competitions...");

    const perpsCompetitions = await db
      .select({
        id: competitions.id,
        name: competitions.name,
        dataSource: perpsCompetitionConfig.dataSource,
        dataSourceConfig: perpsCompetitionConfig.dataSourceConfig,
        evaluationMetric: perpsCompetitionConfig.evaluationMetric,
        initialCapital: perpsCompetitionConfig.initialCapital,
        selfFundingThresholdUsd: perpsCompetitionConfig.selfFundingThresholdUsd,
        minFundingThreshold: perpsCompetitionConfig.minFundingThreshold,
        inactivityHours: perpsCompetitionConfig.inactivityHours,
      })
      .from(competitions)
      .innerJoin(
        perpsCompetitionConfig,
        eq(competitions.id, perpsCompetitionConfig.competitionId),
      )
      .where(eq(competitions.type, "perpetual_futures"));

    logger.info(
      `Found ${perpsCompetitions.length} perpetual futures competitions`,
    );

    let perpsUpdated = 0;
    for (const comp of perpsCompetitions) {
      // Skip if already backfilled
      const existing = await db
        .select({ engineId: competitions.engineId })
        .from(competitions)
        .where(eq(competitions.id, comp.id))
        .limit(1);

      if (existing[0]?.engineId) {
        logger.debug(`Skipping ${comp.name} (already backfilled)`);
        continue;
      }

      // Extract provider from dataSourceConfig
      const dataSourceConfig = comp.dataSourceConfig as {
        provider?: string;
        type?: string;
      };
      const provider = dataSourceConfig?.provider?.toLowerCase();

      // Determine arena based on provider
      let arenaId: string;
      if (provider === "hyperliquid") {
        arenaId = "hyperliquid-perps";
      } else if (provider === "symphony") {
        arenaId = "symphony-perps";
      } else {
        // Default fallback if provider is unknown
        logger.warn(
          `Unknown provider for competition ${comp.name}: ${provider}. Defaulting to hyperliquid-perps`,
        );
        arenaId = "hyperliquid-perps";
      }

      await db
        .update(competitions)
        .set({
          arenaId,
          engineId: "perpetual_futures",
          engineVersion: "1.0.0",
        })
        .where(eq(competitions.id, comp.id));

      perpsUpdated++;
      logger.debug(
        `Updated ${comp.name} → ${arenaId} (provider: ${provider || "unknown"})`,
      );
    }

    logger.info(`✓ Backfilled ${perpsUpdated} perpetual futures competitions`);

    // ========================================
    // 4. Verification
    // ========================================
    const stillMissing = await db
      .select({ id: competitions.id, type: competitions.type })
      .from(competitions)
      .where(isNull(competitions.engineId));

    if (stillMissing.length > 0) {
      logger.warn(
        `⚠️  ${stillMissing.length} competitions still missing engine_id:`,
      );
      stillMissing.forEach((c) => {
        logger.warn(`  - ID: ${c.id}, Type: ${c.type}`);
      });
    } else {
      logger.info("✓ All competitions successfully backfilled");
    }

    // ========================================
    // 5. Arena Assignment Summary
    // ========================================
    logger.info("\n=== Arena Assignment Summary ===");
    const arenaStats = await db
      .select({
        arenaId: competitions.arenaId,
        count: sql<number>`count(*)::int`,
      })
      .from(competitions)
      .where(isNotNull(competitions.arenaId))
      .groupBy(competitions.arenaId);

    arenaStats.forEach((stat) => {
      logger.info(`  ${stat.arenaId}: ${stat.count} competitions`);
    });

    logger.info(
      `\nBackfill complete: ${paperUpdated} paper + ${perpsUpdated} perps = ${paperUpdated + perpsUpdated} total`,
    );
    process.exit(0);
  } catch (error) {
    logger.error("Error during backfill:", error);
    process.exit(1);
  }
}

backfillArenasAndEngineConfig();
