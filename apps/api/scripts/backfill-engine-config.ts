import * as dotenv from "dotenv";
import { eq, isNull, sql } from "drizzle-orm";
import * as path from "path";

import { competitions } from "@recallnet/db/schema/core/defs";
import {
  perpsCompetitionConfig,
  tradingCompetitions,
  tradingConstraints,
} from "@recallnet/db/schema/trading/defs";

import { db } from "@/database/db.js";
import { createLogger } from "@/lib/logger.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("BackfillEngineConfig");

/**
 * Backfill engine configuration for existing competitions
 *
 * Reads from old config tables and populates:
 * - engineId
 * - engineVersion
 * - engineConfig (jsonb with params only, no id/version duplication)
 *
 * Safe to run multiple times (idempotent - skips already backfilled)
 */
async function backfillEngineConfig(): Promise<void> {
  logger.info("Starting engine config backfill...");

  try {
    // ========================================
    // 1. Backfill Paper Trading Competitions
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

      // Build engine config from old table data
      const engineConfig = {
        params: {
          crossChainTradingType: comp.crossChainTradingType || "disallowAll",
          ...(comp.minimumPairAgeHours !== null && {
            tradingConstraints: {
              minimumPairAgeHours: comp.minimumPairAgeHours,
              minimum24hVolumeUsd: comp.minimum24hVolumeUsd,
              minimumLiquidityUsd: comp.minimumLiquidityUsd,
              minimumFdvUsd: comp.minimumFdvUsd,
              minTradesPerDay: comp.minTradesPerDay,
            },
          }),
        },
      };

      await db
        .update(competitions)
        .set({
          engineId: "spot_paper_trading",
          engineVersion: "1.0.0",
          engineConfig: sql`${JSON.stringify(engineConfig)}::jsonb`,
        })
        .where(eq(competitions.id, comp.id));

      paperUpdated++;
      logger.debug(`Updated ${comp.name}`);
    }

    logger.info(`✓ Backfilled ${paperUpdated} paper trading competitions`);

    // ========================================
    // 2. Backfill Perpetual Futures Competitions
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
        apiUrl?: string;
      };

      // Build engine config from perps config table
      const engineConfig = {
        params: {
          dataSource: comp.dataSource,
          dataSourceConfig: comp.dataSourceConfig,
          provider: dataSourceConfig.provider || "symphony",
          evaluationMetric: comp.evaluationMetric,
          initialCapital: parseFloat(comp.initialCapital || "500"),
          selfFundingThreshold: parseFloat(
            comp.selfFundingThresholdUsd || "10",
          ),
          ...(comp.minFundingThreshold && {
            minFundingThreshold: parseFloat(comp.minFundingThreshold),
          }),
          ...(dataSourceConfig.apiUrl && { apiUrl: dataSourceConfig.apiUrl }),
        },
      };

      await db
        .update(competitions)
        .set({
          engineId: "perpetual_futures",
          engineVersion: "1.0.0",
          engineConfig: sql`${JSON.stringify(engineConfig)}::jsonb`,
        })
        .where(eq(competitions.id, comp.id));

      perpsUpdated++;
      logger.debug(`Updated ${comp.name}`);
    }

    logger.info(`✓ Backfilled ${perpsUpdated} perpetual futures competitions`);

    // ========================================
    // 3. Verification
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

    logger.info(
      `\nBackfill complete: ${paperUpdated} paper + ${perpsUpdated} perps = ${paperUpdated + perpsUpdated} total`,
    );
    process.exit(0);
  } catch (error) {
    logger.error("Error during backfill:", error);
    process.exit(1);
  }
}

backfillEngineConfig();
