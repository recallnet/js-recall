import { InsertPerpsSelfFundingAlert } from "@recallnet/db-schema/trading/types";

import {
  batchCreatePerpsSelfFundingAlerts,
  getAgentSelfFundingAlerts,
  getPerpsCompetitionConfig,
} from "@/database/repositories/perps-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import {
  IPerpsDataProvider,
  PerpsAccountSummary,
  Transfer,
} from "@/types/perps.js";

/**
 * Alert creation data with detection details
 */
interface SelfFundingDetection {
  agentId: string;
  competitionId: string;
  expectedEquity: number;
  actualEquity: number;
  unexplainedAmount: number;
  detectionMethod: "transfer_history" | "balance_reconciliation";
  confidence: "high" | "medium" | "low";
  severity: "critical" | "warning" | "info";
  evidence?: Transfer[];
  note?: string;
  accountSnapshot: PerpsAccountSummary;
}

/**
 * Configuration for self-funding detection
 */
interface MonitoringConfig {
  transferThreshold: number;
  reconciliationThreshold: number;
  criticalAmountThreshold: number;
}

/**
 * Result of monitoring a single agent
 */
interface AgentMonitoringResult {
  agentId: string;
  walletAddress: string;
  alerts: SelfFundingDetection[];
  error?: string;
}

/**
 * Service for monitoring perpetual futures competitions for self-funding violations
 * Implements both transfer history and balance reconciliation detection methods
 */
export class PerpsMonitoringService {
  // Default thresholds (in USD)
  private static readonly DEFAULT_TRANSFER_THRESHOLD = 10; // Any deposit > $10
  private static readonly DEFAULT_RECONCILIATION_THRESHOLD = 100; // Unexplained > $100
  private static readonly DEFAULT_CRITICAL_THRESHOLD = 500; // Critical if > $500

  private readonly config: MonitoringConfig;

  constructor(
    private readonly provider: IPerpsDataProvider,
    config?: Partial<MonitoringConfig>,
  ) {
    // Initialize with defaults, allow overrides
    this.config = {
      transferThreshold:
        config?.transferThreshold ??
        PerpsMonitoringService.DEFAULT_TRANSFER_THRESHOLD,
      reconciliationThreshold:
        config?.reconciliationThreshold ??
        PerpsMonitoringService.DEFAULT_RECONCILIATION_THRESHOLD,
      criticalAmountThreshold:
        config?.criticalAmountThreshold ??
        PerpsMonitoringService.DEFAULT_CRITICAL_THRESHOLD,
    };

    serviceLogger.info(
      `[PerpsMonitoringService] Initialized with provider: ${provider.getName()}`,
      this.config,
    );
  }

  /**
   * Monitor multiple agents for self-funding violations
   * Optimized for batch processing to avoid n+1 issues
   */
  async monitorAgents(
    agents: Array<{ agentId: string; walletAddress: string }>,
    competitionId: string,
    competitionStartDate: Date,
    initialCapital: number,
  ): Promise<{
    successful: AgentMonitoringResult[];
    failed: AgentMonitoringResult[];
    totalAlertsCreated: number;
  }> {
    if (agents.length === 0) {
      return { successful: [], failed: [], totalAlertsCreated: 0 };
    }

    serviceLogger.info(
      `[PerpsMonitoringService] Starting monitoring for ${agents.length} agents in competition ${competitionId}`,
    );

    // Get competition config for thresholds
    const competitionConfig = await getPerpsCompetitionConfig(competitionId);
    if (!competitionConfig) {
      serviceLogger.error(
        `[PerpsMonitoringService] No perps config found for competition ${competitionId}`,
      );
      throw new Error(
        `Competition ${competitionId} is not a perps competition`,
      );
    }

    const selfFundingThreshold = competitionConfig.selfFundingThresholdUsd
      ? parseFloat(competitionConfig.selfFundingThresholdUsd)
      : this.config.transferThreshold;

    // Batch fetch existing alerts for all agents to avoid N+1 queries
    const existingAlerts = await this.batchGetExistingAlerts(
      agents.map((a) => a.agentId),
      competitionId,
    );

    // Process agents and collect results
    const results = await Promise.allSettled(
      agents.map((agent) =>
        this.monitorSingleAgent(
          agent,
          competitionId,
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
          existingAlerts.get(agent.agentId) || [],
        ),
      ),
    );

    // Separate successful and failed results
    const successful: AgentMonitoringResult[] = [];
    const failed: AgentMonitoringResult[] = [];
    const alertsToCreate: InsertPerpsSelfFundingAlert[] = [];

    results.forEach((result, index) => {
      const agent = agents[index];
      if (!agent) {
        serviceLogger.error(
          `[PerpsMonitoringService] Unexpected missing agent at index ${index}`,
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
        await batchCreatePerpsSelfFundingAlerts(alertsToCreate);
        totalAlertsCreated = alertsToCreate.length;

        serviceLogger.warn(
          `[PerpsMonitoringService] Created ${totalAlertsCreated} self-funding alerts`,
        );
      } catch (error) {
        serviceLogger.error(
          `[PerpsMonitoringService] Failed to create alerts:`,
          error,
        );
      }
    }

    serviceLogger.info(
      `[PerpsMonitoringService] Monitoring complete: ${successful.length} successful, ${failed.length} failed, ${totalAlertsCreated} alerts created`,
    );

    return { successful, failed, totalAlertsCreated };
  }

  /**
   * Batch fetch existing alerts to avoid N+1 queries
   */
  private async batchGetExistingAlerts(
    agentIds: string[],
    competitionId: string,
  ): Promise<Map<string, Array<{ reviewed: boolean | null }>>> {
    const alertsMap = new Map<string, Array<{ reviewed: boolean | null }>>();

    // Initialize map with empty arrays
    agentIds.forEach((id) => alertsMap.set(id, []));

    // Batch fetch all alerts for these agents
    // Note: We need to fetch individually since the repository doesn't have a batch method
    // This is still better than fetching inside the loop
    const alertPromises = agentIds.map((agentId) =>
      getAgentSelfFundingAlerts(agentId, competitionId)
        .then((alerts) => ({ agentId, alerts }))
        .catch((error) => {
          serviceLogger.error(
            `[PerpsMonitoringService] Failed to fetch alerts for agent ${agentId}:`,
            error,
          );
          return { agentId, alerts: [] };
        }),
    );

    const results = await Promise.all(alertPromises);

    // Populate the map
    results.forEach(({ agentId, alerts }) => {
      alertsMap.set(agentId, alerts);
    });

    return alertsMap;
  }

  /**
   * Monitor a single agent for self-funding violations
   */
  private async monitorSingleAgent(
    agent: { agentId: string; walletAddress: string },
    competitionId: string,
    competitionStartDate: Date,
    initialCapital: number,
    selfFundingThreshold: number,
    existingAlerts: Array<{ reviewed: boolean | null }>,
  ): Promise<AgentMonitoringResult> {
    const alerts: SelfFundingDetection[] = [];

    try {
      // Skip if we already have unreviewed alerts (treat null as unreviewed)
      const hasUnreviewedAlerts = existingAlerts.some((a) => !a.reviewed);
      if (hasUnreviewedAlerts) {
        serviceLogger.debug(
          `[PerpsMonitoringService] Agent ${agent.agentId} already has unreviewed alerts, skipping`,
        );
        return { ...agent, alerts: [] };
      }

      // Fetch account summary (needed for both checks)
      const accountSummary = await this.provider.getAccountSummary(
        agent.walletAddress,
      );

      // 1. Check transfer history (if provider supports it)
      if (this.provider.getTransferHistory) {
        const transferAlert = await this.checkTransferHistory(
          agent.walletAddress,
          competitionStartDate,
          selfFundingThreshold,
          accountSummary,
          agent.agentId,
          competitionId,
        );

        if (transferAlert) {
          alerts.push(transferAlert);
        }
      }

      // 2. Always perform balance reconciliation
      const reconciliationAlert = this.checkBalanceReconciliation(
        accountSummary,
        initialCapital,
        agent.agentId,
        competitionId,
      );

      if (reconciliationAlert) {
        alerts.push(reconciliationAlert);
      }

      return { ...agent, alerts };
    } catch (error) {
      serviceLogger.error(
        `[PerpsMonitoringService] Error monitoring agent ${agent.agentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check transfer history for deposits after competition start
   */
  private async checkTransferHistory(
    walletAddress: string,
    competitionStartDate: Date,
    threshold: number,
    accountSummary: PerpsAccountSummary,
    agentId: string,
    competitionId: string,
  ): Promise<SelfFundingDetection | null> {
    try {
      if (!this.provider.getTransferHistory) {
        return null;
      }

      const transfers = await this.provider.getTransferHistory(
        walletAddress,
        competitionStartDate,
      );

      // Filter for deposits after competition start
      const suspiciousDeposits = transfers.filter(
        (t) =>
          t.type === "deposit" &&
          t.to.toLowerCase() === walletAddress.toLowerCase() &&
          t.timestamp > competitionStartDate &&
          t.amount > threshold,
      );

      if (suspiciousDeposits.length === 0) {
        return null;
      }

      const totalDeposited = suspiciousDeposits.reduce(
        (sum, t) => sum + t.amount,
        0,
      );

      serviceLogger.warn(
        `[PerpsMonitoringService] Detected self-funding via transfers for agent ${agentId}: $${totalDeposited}`,
      );

      return {
        agentId,
        competitionId,
        expectedEquity: accountSummary.initialCapital || 0,
        actualEquity: accountSummary.totalEquity,
        unexplainedAmount: totalDeposited,
        detectionMethod: "transfer_history",
        confidence: "high", // Direct evidence
        severity:
          totalDeposited > this.config.criticalAmountThreshold
            ? "critical"
            : "warning",
        evidence: suspiciousDeposits,
        note: `Detected ${suspiciousDeposits.length} deposit(s) totaling $${totalDeposited}`,
        accountSnapshot: accountSummary,
      };
    } catch (error) {
      serviceLogger.error(
        `[PerpsMonitoringService] Error checking transfer history:`,
        error,
      );
      // Don't throw - continue with reconciliation
      return null;
    }
  }

  /**
   * Check for unexplained balance increases
   */
  private checkBalanceReconciliation(
    accountSummary: PerpsAccountSummary,
    initialCapital: number,
    agentId: string,
    competitionId: string,
  ): SelfFundingDetection | null {
    // Defensive: ensure we have required fields
    const totalEquity = accountSummary.totalEquity || 0;
    const totalPnl = accountSummary.totalPnl || 0;

    // Calculate expected equity
    // Note: This formula might need adjustment based on how the platform
    // handles fees and funding rates. We're not currently subtracting
    // totalFeesPaid as it may already be included in totalPnl.
    const expectedEquity = initialCapital + totalPnl;
    const unexplainedAmount = totalEquity - expectedEquity;

    // Only flag if discrepancy exceeds threshold
    if (Math.abs(unexplainedAmount) <= this.config.reconciliationThreshold) {
      return null;
    }

    serviceLogger.warn(
      `[PerpsMonitoringService] Balance reconciliation discrepancy for agent ${agentId}: ` +
        `Expected: $${expectedEquity.toFixed(2)}, Actual: $${totalEquity.toFixed(2)}, ` +
        `Unexplained: $${unexplainedAmount.toFixed(2)}`,
    );

    return {
      agentId,
      competitionId,
      expectedEquity,
      actualEquity: totalEquity,
      unexplainedAmount,
      detectionMethod: "balance_reconciliation",
      confidence:
        unexplainedAmount > this.config.criticalAmountThreshold
          ? "high"
          : "medium",
      severity:
        unexplainedAmount > this.config.criticalAmountThreshold
          ? "critical"
          : "warning",
      note: `Unexplained balance discrepancy. May include funding rates or platform-specific fees.`,
      accountSnapshot: accountSummary,
    };
  }

  /**
   * Map detection to database alert format
   */
  private mapDetectionToAlert(
    detection: SelfFundingDetection,
  ): InsertPerpsSelfFundingAlert {
    return {
      agentId: detection.agentId,
      competitionId: detection.competitionId,
      expectedEquity: detection.expectedEquity.toString(),
      actualEquity: detection.actualEquity.toString(),
      unexplainedAmount: detection.unexplainedAmount.toString(),
      accountSnapshot: {
        ...detection.accountSnapshot,
        evidence: detection.evidence,
        note: detection.note,
        confidence: detection.confidence,
        severity: detection.severity,
      },
      detectionMethod: detection.detectionMethod,
      reviewed: false,
    };
  }

  /**
   * Check if monitoring is needed for a competition
   */
  async shouldMonitorCompetition(competitionId: string): Promise<boolean> {
    try {
      const config = await getPerpsCompetitionConfig(competitionId);
      if (!config) {
        serviceLogger.debug(
          `[PerpsMonitoringService] No perps config found for competition ${competitionId}`,
        );
        return false;
      }

      // Check if self-funding monitoring is enabled (threshold > 0)
      const threshold = config.selfFundingThresholdUsd
        ? parseFloat(config.selfFundingThresholdUsd)
        : 0;

      return threshold > 0;
    } catch (error) {
      serviceLogger.error(
        `[PerpsMonitoringService] Error checking competition config:`,
        error,
      );
      return false;
    }
  }
}
