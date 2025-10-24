#!/usr/bin/env tsx
import { Decimal } from "decimal.js";
import * as dotenv from "dotenv";
import { and, asc, count, eq, gte } from "drizzle-orm";
import * as path from "path";
import { parseArgs } from "util";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import {
  competitionAgents,
  competitions,
} from "@recallnet/db/schema/core/defs";
import { type SelectCompetition } from "@recallnet/db/schema/core/types";
import {
  perpsCompetitionConfig,
  portfolioSnapshots,
  riskMetricsSnapshots,
} from "@recallnet/db/schema/trading/defs";
import {
  type InsertRiskMetricsSnapshot,
  type SelectPortfolioSnapshot,
  type SelectRiskMetricsSnapshot,
} from "@recallnet/db/schema/trading/types";

import { db } from "@/database/db.js";
import { createLogger } from "@/lib/logger.js";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const logger = createLogger("RiskMetricsBackfill");
const competitionRepo = new CompetitionRepository(db, db, logger);

// Constants from production services
const MIN_DRAWDOWN = 0.0001;
const MIN_DOWNSIDE_DEVIATION = 0.0001;
const MAR = 0; // Minimum Acceptable Return

interface BackfillOptions {
  competitionId?: string;
  batchSize: number;
  dryRun: boolean;
  since?: Date;
}

interface CalmarMetrics {
  calmarRatio: Decimal;
  maxDrawdown: Decimal;
  annualizedReturn: Decimal;
  simpleReturn: Decimal;
}

interface SortinoMetrics {
  sortinoRatio: Decimal;
  downsideDeviation: Decimal;
  annualizedReturn: Decimal;
  simpleReturn: Decimal;
  snapshotCount: number;
}

/**
 * Calculate max drawdown at a point in time
 * Uses the EXACT SQL logic from CompetitionRepository.calculateMaxDrawdown
 * but limited to snapshots up to the given timestamp
 */
async function calculateMaxDrawdownAtPoint(
  agentId: string,
  competitionId: string,
  upToTimestamp: Date,
): Promise<number> {
  // Get first snapshot to use as start date
  const [firstSnapshot] = await db
    .select()
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.agentId, agentId),
        eq(portfolioSnapshots.competitionId, competitionId),
      ),
    )
    .orderBy(asc(portfolioSnapshots.timestamp))
    .limit(1);

  if (!firstSnapshot) return 0;

  // Call the actual repository method with date bounds
  return await competitionRepo.calculateMaxDrawdown(
    agentId,
    competitionId,
    firstSnapshot.timestamp,
    upToTimestamp,
  );
}

/**
 * Calculate Calmar ratio using snapshots up to a point in time
 * EXACTLY matching CalmarRatioService logic
 */
async function calculateCalmarAtPoint(
  agentId: string,
  competitionId: string,
  snapshots: SelectPortfolioSnapshot[],
  upToTimestamp: Date,
): Promise<CalmarMetrics | null> {
  if (snapshots.length < 2) return null;

  // EXACT logic from CalmarRatioService.calculateCalmarRatio:
  const firstValue = new Decimal(snapshots[0]!.totalValue);
  const lastValue = new Decimal(snapshots[snapshots.length - 1]!.totalValue);

  if (firstValue.isZero()) {
    logger.warn(`Starting value is zero for agent ${agentId}`);
    return null;
  }

  // Simple return calculation - EXACT from production
  const simpleReturn = lastValue.minus(firstValue).dividedBy(firstValue);

  // Get max drawdown using the ACTUAL repository method with date bounds
  const maxDrawdown = await calculateMaxDrawdownAtPoint(
    agentId,
    competitionId,
    upToTimestamp,
  );

  // processReturn in production just returns the raw period return
  const periodReturn = simpleReturn;

  // computeCalmarRatio logic - EXACT from production
  if (maxDrawdown > 0) {
    logger.error(`Invalid positive drawdown detected: ${maxDrawdown}`);
    return null;
  }

  const adjustedMaxDrawdown = Math.max(Math.abs(maxDrawdown), MIN_DRAWDOWN);
  const calmarRatio = periodReturn.dividedBy(adjustedMaxDrawdown);

  return {
    calmarRatio,
    maxDrawdown: new Decimal(maxDrawdown),
    annualizedReturn: periodReturn, // In production, this is the period return
    simpleReturn,
  };
}

/**
 * Calculate Sortino ratio using snapshots up to a point in time
 * Using the exact logic from SortinoRatioService
 */
function calculateSortinoAtPoint(
  snapshots: SelectPortfolioSnapshot[],
): SortinoMetrics | null {
  if (snapshots.length < 2) return null;

  // Calculate period returns
  const returns: Decimal[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prevValue = new Decimal(snapshots[i - 1]!.totalValue);
    const currValue = new Decimal(snapshots[i]!.totalValue);

    if (prevValue.greaterThan(0)) {
      const periodReturn = currValue.minus(prevValue).dividedBy(prevValue);
      returns.push(periodReturn);
    }
  }

  if (returns.length === 0) return null;

  // Calculate average return
  const avgReturn = returns
    .reduce((sum, r) => sum.plus(r), new Decimal(0))
    .dividedBy(returns.length);

  // Calculate downside deviation
  const mar = new Decimal(MAR);
  let downsideSquaredSum = new Decimal(0);

  for (const returnRate of returns) {
    if (returnRate.lessThan(mar)) {
      const deviation = returnRate.minus(mar);
      downsideSquaredSum = downsideSquaredSum.plus(deviation.pow(2));
    }
  }

  // Note: We divide by total returns.length, not just downside returns count
  const downsideVariance = downsideSquaredSum.dividedBy(returns.length);
  const downsideDeviation = downsideVariance.sqrt();

  // Use minimum downside deviation to avoid division by zero
  const adjustedDownsideDeviation = downsideDeviation.isZero()
    ? new Decimal(MIN_DOWNSIDE_DEVIATION)
    : downsideDeviation;

  // Calculate Sortino ratio
  const sortinoRatio = avgReturn
    .minus(mar)
    .dividedBy(adjustedDownsideDeviation);

  // Calculate simple return (first to last)
  const firstValue = new Decimal(snapshots[0]!.totalValue);
  const lastValue = new Decimal(snapshots[snapshots.length - 1]!.totalValue);
  const simpleReturn = lastValue.minus(firstValue).dividedBy(firstValue);

  return {
    sortinoRatio,
    downsideDeviation,
    annualizedReturn: avgReturn, // Simplified for backfill
    simpleReturn,
    snapshotCount: snapshots.length,
  };
}

/**
 * Get target competitions for backfill
 */
async function getTargetCompetitions(
  competitionId?: string,
  since?: Date,
): Promise<SelectCompetition[]> {
  let query = db
    .select()
    .from(competitions)
    .where(
      and(
        eq(competitions.type, "perpetual_futures"),
        eq(competitions.status, "ended"),
      ),
    )
    .$dynamic();

  if (competitionId) {
    query = query.where(eq(competitions.id, competitionId));
  }

  if (since) {
    query = query.where(gte(competitions.endDate, since));
  }

  // Only competitions that have perps config
  const compsWithConfig = await query;
  const validComps = [];

  for (const comp of compsWithConfig) {
    const config = await db
      .select()
      .from(perpsCompetitionConfig)
      .where(eq(perpsCompetitionConfig.competitionId, comp.id))
      .limit(1);

    if (config.length > 0) {
      validComps.push(comp);
    }
  }

  return validComps;
}

/**
 * Main backfill function
 */
async function backfillRiskMetrics(options: BackfillOptions): Promise<void> {
  const startTime = Date.now();

  logger.info(
    {
      competitionId: options.competitionId,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
      since: options.since?.toISOString(),
    },
    "Starting risk metrics backfill",
  );

  const competitions = await getTargetCompetitions(
    options.competitionId,
    options.since,
  );

  if (competitions.length === 0) {
    logger.warn("No competitions found matching criteria");
    return;
  }

  logger.info(`Found ${competitions.length} competition(s) to process`);

  let totalMetricsCreated = 0;

  for (const competition of competitions) {
    logger.info(
      {
        competitionId: competition.id,
        name: competition.name,
        startDate: competition.startDate,
        endDate: competition.endDate,
      },
      "Processing competition",
    );

    // Get ONLY ACTIVE agents in the competition (exclude disqualified)
    const agents = await db
      .select()
      .from(competitionAgents)
      .where(
        and(
          eq(competitionAgents.competitionId, competition.id),
          eq(competitionAgents.status, "active"),
        ),
      );

    logger.info(
      `Found ${agents.length} ACTIVE agents in competition (disqualified excluded)`,
    );

    for (const agent of agents) {
      logger.info({ agentId: agent.agentId }, "Processing agent");

      // Get ALL snapshots for this agent in chronological order
      const allSnapshots = await db
        .select()
        .from(portfolioSnapshots)
        .where(
          and(
            eq(portfolioSnapshots.competitionId, competition.id),
            eq(portfolioSnapshots.agentId, agent.agentId),
          ),
        )
        .orderBy(asc(portfolioSnapshots.timestamp));

      if (allSnapshots.length < 2) {
        logger.debug(
          {
            agentId: agent.agentId,
            snapshotCount: allSnapshots.length,
          },
          "Skipping agent - insufficient snapshots",
        );
        continue;
      }

      logger.info(
        {
          agentId: agent.agentId,
          snapshotCount: allSnapshots.length,
        },
        "Processing agent snapshots",
      );

      // Check for existing risk metrics to avoid duplicates
      if (!options.dryRun) {
        const existingCount = await db
          .select({ count: count() })
          .from(riskMetricsSnapshots)
          .where(
            and(
              eq(riskMetricsSnapshots.competitionId, competition.id),
              eq(riskMetricsSnapshots.agentId, agent.agentId),
            ),
          );

        const existingMetricsCount = existingCount[0]?.count ?? 0;
        if (existingMetricsCount > 0) {
          logger.warn(
            {
              agentId: agent.agentId,
              existingCount: existingMetricsCount,
            },
            "Agent already has risk metrics, skipping",
          );
          continue;
        }
      }

      let metricsToInsert: InsertRiskMetricsSnapshot[] = [];
      let processedCount = 0;

      // Process snapshots progressively
      // Start from index 1 (need at least 2 snapshots for calculations)
      for (let i = 1; i < allSnapshots.length; i++) {
        // Use all snapshots up to and including current index
        const historicalSnapshots = allSnapshots.slice(0, i + 1);
        const currentTimestamp = allSnapshots[i]!.timestamp;

        // Calculate both metrics using historical data
        const calmarMetrics = await calculateCalmarAtPoint(
          agent.agentId,
          competition.id,
          historicalSnapshots,
          currentTimestamp,
        );
        const sortinoMetrics = calculateSortinoAtPoint(historicalSnapshots);

        if (calmarMetrics && sortinoMetrics) {
          metricsToInsert.push({
            competitionId: competition.id,
            agentId: agent.agentId,
            timestamp: currentTimestamp,
            calmarRatio: calmarMetrics.calmarRatio.toFixed(8),
            sortinoRatio: sortinoMetrics.sortinoRatio.toFixed(8),
            maxDrawdown: calmarMetrics.maxDrawdown.toFixed(8),
            downsideDeviation: sortinoMetrics.downsideDeviation.toFixed(8),
            annualizedReturn: calmarMetrics.annualizedReturn.toFixed(8),
            simpleReturn: calmarMetrics.simpleReturn.toFixed(8),
          });
          processedCount++;

          // Insert in batches
          if (metricsToInsert.length >= options.batchSize) {
            if (!options.dryRun) {
              await db.insert(riskMetricsSnapshots).values(metricsToInsert);
              logger.debug(
                {
                  agentId: agent.agentId,
                  inserted: metricsToInsert.length,
                  progress: `${i + 1}/${allSnapshots.length}`,
                },
                "Inserted batch of risk metrics",
              );
            }
            totalMetricsCreated += metricsToInsert.length;
            metricsToInsert = [];
          }
        }
      }

      // Insert remaining metrics
      if (metricsToInsert.length > 0 && !options.dryRun) {
        await db.insert(riskMetricsSnapshots).values(metricsToInsert);
        logger.debug(
          {
            agentId: agent.agentId,
            inserted: metricsToInsert.length,
          },
          "Inserted final batch of risk metrics",
        );
      }
      totalMetricsCreated += metricsToInsert.length;

      logger.info(
        {
          agentId: agent.agentId,
          metricsCreated: processedCount,
          dryRun: options.dryRun,
        },
        "Completed agent processing",
      );
    }

    logger.info(
      {
        competitionId: competition.id,
        agentsProcessed: agents.length,
      },
      "Completed competition processing",
    );
  }

  const duration = Date.now() - startTime;
  logger.info(
    {
      totalMetricsCreated,
      competitionsProcessed: competitions.length,
      durationMs: duration,
      dryRun: options.dryRun,
    },
    "Risk metrics backfill completed",
  );
}

/**
 * Validate backfilled data
 */
async function validateBackfill(competitionId: string): Promise<void> {
  logger.info({ competitionId }, "Validating backfilled data");

  // Count portfolio snapshots
  const snapshotCount = await db
    .select({ count: count() })
    .from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.competitionId, competitionId));

  // Count risk metrics snapshots
  const riskMetricsCount = await db
    .select({ count: count() })
    .from(riskMetricsSnapshots)
    .where(eq(riskMetricsSnapshots.competitionId, competitionId));

  const portfolioCount = snapshotCount[0]?.count ?? 0;
  const riskCount = riskMetricsCount[0]?.count ?? 0;
  const expectedMetrics = Math.max(0, portfolioCount - 24); // -1 per agent (need 2 snapshots min)

  logger.info(
    {
      portfolioSnapshots: portfolioCount,
      riskMetricsSnapshots: riskCount,
      expectedApprox: expectedMetrics,
    },
    "Snapshot counts",
  );

  // Sample some metrics to verify they're evolving
  const sampleMetrics = await db
    .select()
    .from(riskMetricsSnapshots)
    .where(eq(riskMetricsSnapshots.competitionId, competitionId))
    .orderBy(asc(riskMetricsSnapshots.timestamp))
    .limit(100);

  if (sampleMetrics.length > 0) {
    const uniqueCalmar = new Set(
      sampleMetrics.map((m: SelectRiskMetricsSnapshot) => m.calmarRatio),
    );
    const uniqueSortino = new Set(
      sampleMetrics.map((m: SelectRiskMetricsSnapshot) => m.sortinoRatio),
    );

    logger.info(
      {
        sampleSize: sampleMetrics.length,
        uniqueCalmarValues: uniqueCalmar.size,
        uniqueSortinoValues: uniqueSortino.size,
      },
      "Metrics diversity check",
    );

    if (uniqueCalmar.size < 2) {
      logger.warn("Warning: Calmar ratios are not evolving over time!");
    }
    if (uniqueSortino.size < 2) {
      logger.warn("Warning: Sortino ratios are not evolving over time!");
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        "competition-id": { type: "string" },
        "batch-size": { type: "string" },
        "dry-run": { type: "boolean" },
        since: { type: "string" },
        validate: { type: "boolean" },
      },
    });

    // If validate flag is set, just run validation
    if (values.validate && values["competition-id"]) {
      await validateBackfill(values["competition-id"]);
      process.exit(0);
    }

    const options: BackfillOptions = {
      competitionId: values["competition-id"],
      batchSize: parseInt(values["batch-size"] || "50"),
      dryRun: values["dry-run"] || false,
      since: values.since ? new Date(values.since) : undefined,
    };

    await backfillRiskMetrics(options);

    // If a specific competition was processed, validate it
    if (options.competitionId && !options.dryRun) {
      await validateBackfill(options.competitionId);
    }

    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Fatal error in backfill script");
    process.exit(1);
  }
}

// Run the script
main();
