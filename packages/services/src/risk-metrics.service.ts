import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import type { SelectPerpsRiskMetrics } from "@recallnet/db/schema/trading/types";
import type { Database } from "@recallnet/db/types";

import { CalmarRatioService } from "./calmar-ratio.service.js";
import { SortinoRatioService } from "./sortino-ratio.service.js";

/**
 * Result of calculating and saving all risk metrics
 */
export interface AllRiskMetricsResult {
  metrics: SelectPerpsRiskMetrics;
}

/**
 * Orchestrator service for calculating all risk metrics atomically
 * Coordinates CalmarRatioService and SortinoRatioService within a database transaction
 * to ensure all-or-nothing persistence
 */
export class RiskMetricsService {
  private calmarRatioService: CalmarRatioService;
  private sortinoRatioService: SortinoRatioService;
  private perpsRepo: PerpsRepository;
  private competitionRepo: CompetitionRepository;
  private db: Database;
  private logger: Logger;

  constructor(
    calmarRatioService: CalmarRatioService,
    sortinoRatioService: SortinoRatioService,
    perpsRepo: PerpsRepository,
    competitionRepo: CompetitionRepository,
    db: Database,
    logger: Logger,
  ) {
    this.calmarRatioService = calmarRatioService;
    this.sortinoRatioService = sortinoRatioService;
    this.perpsRepo = perpsRepo;
    this.competitionRepo = competitionRepo;
    this.db = db;
    this.logger = logger;
  }

  /**
   * Calculate and save all risk metrics (Calmar and Sortino) atomically
   * Executes both calculations sequentially within a transaction to ensure
   * consistent state - either both metrics are saved or neither
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Combined risk metrics after successful calculation and persistence
   */
  async calculateAndSaveAllRiskMetrics(
    agentId: string,
    competitionId: string,
  ): Promise<AllRiskMetricsResult> {
    try {
      this.logger.info(
        `[RiskMetrics] Starting atomic risk metrics calculation for agent ${agentId}`,
      );

      const result = await this.db.transaction(async (tx) => {
        // Calculate both metrics (no longer saving individually)
        const calmarMetrics =
          await this.calmarRatioService.calculateCalmarRatio(
            agentId,
            competitionId,
          );

        const sortinoMetrics =
          await this.sortinoRatioService.calculateSortinoRatio(
            agentId,
            competitionId,
          );

        // Combine metrics into single record
        const combinedMetrics = {
          ...calmarMetrics,
          ...sortinoMetrics,
          // Ensure we don't duplicate common fields
          agentId,
          competitionId,
        };

        // Single atomic save
        const savedMetrics = await this.perpsRepo.upsertRiskMetrics(
          combinedMetrics,
          tx,
        );

        // Get latest portfolio snapshot for timestamp
        const snapshots = await this.competitionRepo.getAgentPortfolioSnapshots(
          competitionId,
          agentId,
          1, // Only need latest
        );

        const latestSnapshot = snapshots[0];

        if (latestSnapshot) {
          // Save time-series snapshot with all metrics
          await this.perpsRepo.batchCreateRiskMetricsSnapshots(
            [
              {
                agentId,
                competitionId,
                timestamp: latestSnapshot.timestamp,
                calmarRatio: savedMetrics.calmarRatio,
                sortinoRatio: savedMetrics.sortinoRatio,
                simpleReturn: savedMetrics.simpleReturn,
                annualizedReturn: savedMetrics.annualizedReturn,
                maxDrawdown: savedMetrics.maxDrawdown,
                downsideDeviation: savedMetrics.downsideDeviation,
              },
            ],
            tx,
          );

          this.logger.debug(
            `[RiskMetrics] Saved time-series snapshot for agent ${agentId}`,
          );
        }

        return savedMetrics;
      });

      this.logger.info(
        `[RiskMetrics] Successfully calculated and saved all risk metrics for agent ${agentId}`,
      );

      return { metrics: result };
    } catch (error) {
      this.logger.error(
        `[RiskMetrics] Error calculating risk metrics for agent ${agentId}:`,
        error,
      );
      throw error;
    }
  }
}
