import { Decimal } from "decimal.js";
import { Logger } from "pino";

import { SpotLiveRepository } from "@recallnet/db/repositories/spot-live";
import { SpecificChain } from "@recallnet/db/repositories/types";
import {
  InsertSpotLiveSelfFundingAlert,
  SelectSpotLiveTransferHistory,
} from "@recallnet/db/schema/trading/types";

/**
 * Alert creation data with detection details
 */
interface SelfFundingAlert {
  agentId: string;
  competitionId: string;
  detectedValue: number;
  thresholdValue: number;
  violationType: "deposit" | "withdrawal_exceeds_limit";
  detectionMethod: "transfer_history";
  specificChain: SpecificChain | null;
  txHash: string | null;
  confidence: "high" | "medium" | "low";
  severity: "critical" | "warning";
  evidence?: SelectSpotLiveTransferHistory[];
  note: string;
}

/**
 * Configuration for self-funding detection
 */
interface MonitoringConfig {
  criticalAmountThreshold: number;
}

/**
 * Result of monitoring a single agent
 */
interface AgentMonitoringResult {
  agentId: string;
  walletAddress: string;
  alerts: SelfFundingAlert[];
  error?: string;
}

/**
 * Service for monitoring spot live trading competitions for self-funding violations
 * Reads transfer data and portfolio snapshots from database
 */
export class SpotLiveMonitoringService {
  private spotLiveRepo: SpotLiveRepository;
  private logger: Logger;

  // Default thresholds (in USD)
  // Transfer detection: ALL mid-competition transfers are violations (no threshold)
  // Critical: Classify violations > $500 as critical priority
  private static readonly DEFAULT_CRITICAL_THRESHOLD = 500;

  private readonly config: MonitoringConfig;

  constructor(
    spotLiveRepo: SpotLiveRepository,
    logger: Logger,
    config?: Partial<MonitoringConfig>,
  ) {
    this.spotLiveRepo = spotLiveRepo;
    this.logger = logger;

    // Initialize with defaults, allow overrides
    this.config = {
      criticalAmountThreshold:
        config?.criticalAmountThreshold ??
        SpotLiveMonitoringService.DEFAULT_CRITICAL_THRESHOLD,
    };

    this.logger.info(
      { config: this.config },
      `[SpotLiveMonitoringService] Initialized`,
    );
  }

  /**
   * Monitor multiple agents for self-funding violations
   * Main entry point from SpotDataProcessor
   * @param agents Array of agents to monitor
   * @param competitionId Competition ID
   * @param competitionStartDate Competition start date
   * @param competitionEndDate Competition end date (null for active competitions)
   * @returns Monitoring results
   */
  async monitorAgents(
    agents: Array<{ agentId: string; walletAddress: string }>,
    competitionId: string,
    competitionStartDate: Date,
    competitionEndDate: Date | null,
  ): Promise<{
    successful: AgentMonitoringResult[];
    failed: AgentMonitoringResult[];
    totalAlertsCreated: number;
  }> {
    if (agents.length === 0) {
      return { successful: [], failed: [], totalAlertsCreated: 0 };
    }

    this.logger.info(
      `[SpotLiveMonitoringService] Starting monitoring for ${agents.length} agents in competition ${competitionId}`,
    );

    // Batch fetch existing alerts for all agents
    const existingAlerts = await this.batchGetExistingAlerts(
      agents.map((a) => a.agentId),
      competitionId,
    );

    // DECISION: Using Promise.allSettled for monitoring multiple agents because:
    // 1. Monitoring one agent should never prevent monitoring others
    // 2. Self-funding detection is independent per agent
    // 3. We want to detect and alert on as many violations as possible
    // 4. Failed monitoring is tracked per agent in the results
    const results = await Promise.allSettled(
      agents.map((agent) =>
        this.monitorSingleAgent(
          agent,
          competitionId,
          competitionStartDate,
          competitionEndDate,
          existingAlerts.get(agent.agentId) ?? [],
        ),
      ),
    );

    // Separate successful and failed results
    const successful: AgentMonitoringResult[] = [];
    const failed: AgentMonitoringResult[] = [];
    const alertsToCreate: InsertSpotLiveSelfFundingAlert[] = [];

    results.forEach((result, index) => {
      const agent = agents[index];
      if (!agent) {
        this.logger.error(
          `[SpotLiveMonitoringService] Unexpected missing agent at index ${index}`,
        );
        return;
      }

      if (result.status === "fulfilled") {
        successful.push(result.value);

        // Collect alerts for batch creation
        result.value.alerts.forEach((detection) => {
          alertsToCreate.push(this.mapDetectionToAlert(detection));
        });
      } else {
        failed.push({
          agentId: agent.agentId,
          walletAddress: agent.walletAddress,
          alerts: [],
          error: result.reason?.message || "Unknown error",
        });
      }
    });

    // Batch create all alerts at once
    let totalAlertsCreated = 0;
    if (alertsToCreate.length > 0) {
      try {
        await this.spotLiveRepo.batchCreateSpotLiveSelfFundingAlerts(
          alertsToCreate,
        );
        totalAlertsCreated = alertsToCreate.length;

        this.logger.warn(
          `[SpotLiveMonitoringService] Created ${totalAlertsCreated} self-funding alerts`,
        );
      } catch (error) {
        this.logger.error(
          { error },
          `[SpotLiveMonitoringService] Failed to create alerts:`,
        );
      }
    }

    this.logger.info(
      `[SpotLiveMonitoringService] Monitoring complete: ${successful.length} successful, ${failed.length} failed, ${totalAlertsCreated} alerts created`,
    );

    return { successful, failed, totalAlertsCreated };
  }

  /**
   * Batch fetch existing alerts for multiple agents
   * Returns empty map on error to allow monitoring to continue
   */
  private async batchGetExistingAlerts(
    agentIds: string[],
    competitionId: string,
  ): Promise<Map<string, Array<{ reviewed: boolean | null }>>> {
    try {
      const alertsMap =
        await this.spotLiveRepo.batchGetAgentsSpotLiveSelfFundingAlerts(
          agentIds,
          competitionId,
        );

      return alertsMap;
    } catch (error) {
      this.logger.error(
        { error },
        `[SpotLiveMonitoringService] Failed to batch fetch alerts:`,
      );

      // DECISION: Return empty alerts map on database error rather than failing.
      // This allows monitoring to continue and potentially create new alerts.
      // The risk is we might create duplicate alerts, but that's better than
      // missing new violations due to a database query failure.
      const emptyMap = new Map<string, Array<{ reviewed: boolean | null }>>();
      agentIds.forEach((id) => emptyMap.set(id, []));
      return emptyMap;
    }
  }

  /**
   * Monitor a single agent for self-funding violations
   */
  private async monitorSingleAgent(
    agent: { agentId: string; walletAddress: string },
    competitionId: string,
    competitionStartDate: Date,
    competitionEndDate: Date | null,
    existingAlerts: Array<{ reviewed: boolean | null }>,
  ): Promise<AgentMonitoringResult> {
    const alerts: SelfFundingAlert[] = [];

    try {
      // Skip if we already have unreviewed alerts (treat null as unreviewed)
      const hasUnreviewedAlerts = existingAlerts.some((a) => !a.reviewed);
      if (hasUnreviewedAlerts) {
        this.logger.debug(
          `[SpotLiveMonitoringService] Agent ${agent.agentId} already has unreviewed alerts, skipping`,
        );
        return { ...agent, alerts: [] };
      }

      // 1. Check transfer history (read from database)
      const transferAlert = await this.checkTransferHistory(
        agent.agentId,
        competitionId,
        competitionStartDate,
        competitionEndDate,
      );

      if (transferAlert) {
        alerts.push(transferAlert);
      }

      return { ...agent, alerts };
    } catch (error) {
      this.logger.error(
        { error },
        `[SpotLiveMonitoringService] Error monitoring agent ${agent.agentId}:`,
      );
      throw error;
    }
  }

  /**
   * Check transfer history for violations
   * ALL transfers during competition period are violations (deposits or withdrawals)
   * Note: Unlike perps which needs walletAddress to filter transfers from provider API,
   * spot live reads pre-filtered transfers from database using agentId
   */
  private async checkTransferHistory(
    agentId: string,
    competitionId: string,
    competitionStartDate: Date,
    competitionEndDate: Date | null,
  ): Promise<SelfFundingAlert | null> {
    try {
      // Read transfers from database (already saved by SpotDataProcessor)
      // Filter by competition period: after start AND before end (if ended)
      const transfers = await this.spotLiveRepo.getAgentSpotLiveTransfers(
        agentId,
        competitionId,
        competitionStartDate,
        competitionEndDate ?? undefined, // null → undefined for optional parameter
      );

      if (transfers.length === 0) {
        return null;
      }

      // ALL mid-competition transfers are violations
      // Separate deposits and withdrawals for reporting
      const deposits = transfers.filter((t) => t.type === "deposit");
      const withdrawals = transfers.filter((t) => t.type === "withdraw");

      // Calculate totals using Decimal for precision
      const totalDepositedUsd = deposits
        .reduce(
          (sum, t) => sum.plus(new Decimal(t.amountUsd ?? "0")),
          new Decimal(0),
        )
        .toNumber();

      const totalWithdrawnUsd = withdrawals
        .reduce(
          (sum, t) => sum.plus(new Decimal(t.amountUsd ?? "0")),
          new Decimal(0),
        )
        .toNumber();

      const totalTransferredUsd = totalDepositedUsd + totalWithdrawnUsd;

      // Determine primary violation type (deposits are more serious)
      const violationType: "deposit" | "withdrawal_exceeds_limit" =
        deposits.length > 0 ? "deposit" : "withdrawal_exceeds_limit";

      // Confidence is always high since transfers are explicitly prohibited
      const confidence: "high" | "medium" | "low" = "high";

      // Build detailed note about the violation
      let note = `Mid-competition transfers are PROHIBITED. Found ${transfers.length} violation(s): `;
      if (deposits.length > 0) {
        note += `${deposits.length} deposit(s) totaling $${totalDepositedUsd.toFixed(2)}`;
      }
      if (withdrawals.length > 0) {
        if (deposits.length > 0) note += " and ";
        note += `${withdrawals.length} withdrawal(s) totaling $${totalWithdrawnUsd.toFixed(2)}`;
      }

      this.logger.warn(
        `[SpotLiveMonitoringService] Transfer violation detected for agent ${agentId}: ${note}`,
      );

      // Get representative chain and txHash for alert metadata
      const firstTransfer = transfers[0];
      const specificChain = firstTransfer?.specificChain ?? null;
      const txHash = firstTransfer?.txHash ?? null;

      return {
        agentId,
        competitionId,
        detectedValue: totalTransferredUsd,
        thresholdValue: 0, // Threshold not used - all transfers are violations
        violationType,
        detectionMethod: "transfer_history",
        specificChain,
        txHash,
        confidence,
        severity:
          totalTransferredUsd > this.config.criticalAmountThreshold
            ? "critical"
            : "warning",
        evidence: transfers,
        note,
      };
    } catch (error) {
      this.logger.error(
        { error },
        `[SpotLiveMonitoringService] Error checking transfer history:`,
      );
      // DECISION: Transfer history check is critical for spot live.
      // Unlike perps (where transfer history is optional), spot live competitions
      // rely on transfer detection for violation enforcement.
      // However, we still return null to allow reconciliation check to run.
      return null;
    }
  }

  /**
   * Map detection to database alert format
   */
  private mapDetectionToAlert(
    detection: SelfFundingAlert,
  ): InsertSpotLiveSelfFundingAlert {
    return {
      agentId: detection.agentId,
      competitionId: detection.competitionId,
      detectionMethod: detection.detectionMethod,
      violationType: detection.violationType,
      detectedValue: detection.detectedValue.toString(),
      thresholdValue: detection.thresholdValue.toString(),
      specificChain: detection.specificChain,
      txHash: detection.txHash,
      transferSnapshot: {
        evidence: detection.evidence,
        note: detection.note,
        confidence: detection.confidence,
        severity: detection.severity,
      },
      reviewed: false,
    };
  }

  /**
   * Check if monitoring is needed for a competition
   */
  async shouldMonitorCompetition(competitionId: string): Promise<boolean> {
    try {
      const config =
        await this.spotLiveRepo.getSpotLiveCompetitionConfig(competitionId);
      if (!config) {
        this.logger.debug(
          `[SpotLiveMonitoringService] No spot live config found for competition ${competitionId}`,
        );
        return false;
      }

      // Check if self-funding monitoring is enabled
      if (!config.selfFundingThresholdUsd) {
        // null/undefined means monitoring is disabled
        return false;
      }

      const threshold = parseFloat(config.selfFundingThresholdUsd);
      // Monitor if threshold is a valid number >= 0 (0 means any deposit is flagged)
      return !isNaN(threshold) && threshold >= 0;
    } catch (error) {
      this.logger.error(
        { error },
        `[SpotLiveMonitoringService] Error checking competition config:`,
      );
      return false;
    }
  }
}
