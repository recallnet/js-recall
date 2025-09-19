import { Decimal } from "decimal.js";

import { InsertPerpsSelfFundingAlert } from "@recallnet/db-schema/trading/types";

import {
  batchCreatePerpsSelfFundingAlerts,
  batchGetAgentsSelfFundingAlerts,
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
 * This is the internal representation used by the monitoring service
 */
interface SelfFundingAlert {
  agentId: string;
  competitionId: string;
  expectedEquity: number;
  actualEquity: number;
  unexplainedAmount: number;
  detectionMethod: "transfer_history" | "balance_reconciliation";
  confidence: "high" | "medium" | "low";
  severity: "critical" | "warning";
  evidence?: Transfer[];
  note: string;
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
  alerts: SelfFundingAlert[];
  error?: string;
}

/**
 * Service for monitoring perpetual futures competitions for self-funding violations
 * Implements both transfer history and balance reconciliation detection methods
 */
export class PerpsMonitoringService {
  // Default thresholds (in USD)
  // Competition rules: NO external deposits allowed during competition
  private static readonly DEFAULT_TRANSFER_THRESHOLD = 0; // Any deposit > $0 is suspicious
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
   * Monitor multiple agents for self-funding violations with pre-fetched data
   * This is the main entry point from PerpsDataProcessor in production
   * @param agents Array of agents to monitor
   * @param accountSummaries Pre-fetched account summaries (optional)
   * @param competitionId Competition ID
   * @param competitionStartDate Competition start date
   * @param initialCapital Initial capital for the competition
   * @param selfFundingThreshold Self-funding threshold in USD
   * @returns Monitoring results
   */
  async monitorAgentsWithData(
    agents: Array<{ agentId: string; walletAddress: string }>,
    accountSummaries: Map<string, PerpsAccountSummary> | undefined,
    competitionId: string,
    competitionStartDate: Date,
    initialCapital: number,
    selfFundingThreshold: number,
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
          accountSummaries?.get(agent.agentId),
          competitionId,
          competitionStartDate,
          initialCapital,
          selfFundingThreshold,
          existingAlerts.get(agent.agentId) ?? [],
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
   * Batch fetch existing alerts
   */
  private async batchGetExistingAlerts(
    agentIds: string[],
    competitionId: string,
  ): Promise<Map<string, Array<{ reviewed: boolean | null }>>> {
    try {
      // Batch method to fetch all alerts efficiently
      const alertsMap = await batchGetAgentsSelfFundingAlerts(
        agentIds,
        competitionId,
      );

      // The batch method returns Map<string, SelectPerpsSelfFundingAlert[]>
      // which is compatible since SelectPerpsSelfFundingAlert includes reviewed field
      return alertsMap;
    } catch (error) {
      serviceLogger.error(
        `[PerpsMonitoringService] Failed to batch fetch alerts:`,
        error,
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
    preFetchedSummary: PerpsAccountSummary | undefined,
    competitionId: string,
    competitionStartDate: Date,
    initialCapital: number,
    selfFundingThreshold: number,
    existingAlerts: Array<{ reviewed: boolean | null }>,
  ): Promise<AgentMonitoringResult> {
    const alerts: SelfFundingAlert[] = [];

    try {
      // Skip if we already have unreviewed alerts (treat null as unreviewed)
      const hasUnreviewedAlerts = existingAlerts.some((a) => !a.reviewed);
      if (hasUnreviewedAlerts) {
        serviceLogger.debug(
          `[PerpsMonitoringService] Agent ${agent.agentId} already has unreviewed alerts, skipping`,
        );
        return { ...agent, alerts: [] };
      }

      // DECISION: Account summary is required - if it fails, the entire agent monitoring fails.
      // This is intentional because we cannot calculate equity or detect self-funding without it.
      // The provider has built-in retry logic to handle transient failures.
      const accountSummary =
        preFetchedSummary ||
        (await this.provider.getAccountSummary(agent.walletAddress));

      if (preFetchedSummary) {
        serviceLogger.debug(
          `[PerpsMonitoringService] Using pre-fetched account summary for agent ${agent.agentId}`,
        );
      }

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
   * Detects both individual large deposits and cumulative small deposits (structuring)
   */
  private async checkTransferHistory(
    walletAddress: string,
    competitionStartDate: Date,
    threshold: number,
    accountSummary: PerpsAccountSummary,
    agentId: string,
    competitionId: string,
  ): Promise<SelfFundingAlert | null> {
    try {
      if (!this.provider.getTransferHistory) {
        return null;
      }

      const transfers = await this.provider.getTransferHistory(
        walletAddress,
        competitionStartDate,
      );

      // Get ALL deposits to this address after competition start
      const allDeposits = transfers.filter(
        (t) =>
          t.type === "deposit" &&
          t.to.toLowerCase() === walletAddress.toLowerCase() &&
          t.timestamp > competitionStartDate,
      );

      if (allDeposits.length === 0) {
        return null;
      }

      // Calculate total deposited using Decimal for precision
      const totalDeposited = allDeposits
        .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0))
        .toNumber();

      // Check for violations:
      // 1. Any single deposit exceeds threshold
      // 2. Total of all deposits exceeds threshold (catches structuring)
      const thresholdDecimal = new Decimal(threshold);
      const largeDeposits = allDeposits.filter((t) =>
        new Decimal(t.amount).greaterThan(thresholdDecimal),
      );
      const hasLargeDeposit = largeDeposits.length > 0;
      const hasSuspiciousTotal = new Decimal(totalDeposited).greaterThan(
        thresholdDecimal,
      );

      if (!hasLargeDeposit && !hasSuspiciousTotal) {
        return null;
      }

      // Determine confidence and description based on pattern
      let confidence: "high" | "medium" | "low";
      let note: string;

      if (hasLargeDeposit) {
        // Clear violation: individual deposit(s) exceed threshold
        confidence = "high";
        note = `Detected ${largeDeposits.length} large deposit(s) exceeding $${threshold} threshold, total: $${totalDeposited.toFixed(2)}`;
      } else {
        // Potential structuring: many small deposits that add up
        const avgDepositSize = new Decimal(totalDeposited)
          .dividedBy(allDeposits.length)
          .toNumber();
        confidence = allDeposits.length > 5 ? "high" : "medium"; // Higher confidence if many small deposits
        note = `Potential structuring: ${allDeposits.length} deposits averaging $${avgDepositSize.toFixed(2)} each, totaling $${totalDeposited.toFixed(2)} (exceeds $${threshold} threshold)`;
      }

      serviceLogger.warn(
        `[PerpsMonitoringService] Detected self-funding via transfers for agent ${agentId}: ${note}`,
      );

      return {
        agentId,
        competitionId,
        expectedEquity: accountSummary.initialCapital ?? 0,
        actualEquity: accountSummary.totalEquity,
        unexplainedAmount: totalDeposited,
        detectionMethod: "transfer_history",
        confidence,
        severity:
          totalDeposited > this.config.criticalAmountThreshold
            ? "critical"
            : "warning",
        evidence: allDeposits, // Include ALL deposits as evidence
        note,
        accountSnapshot: accountSummary,
      };
    } catch (error) {
      serviceLogger.error(
        `[PerpsMonitoringService] Error checking transfer history:`,
        error,
      );
      // DECISION: Transfer history is optional - we continue with balance reconciliation.
      // This is because:
      // 1. Not all providers support transfer history
      // 2. Transfer history API might be less reliable than account data
      // 3. Balance reconciliation can still detect self-funding without transfer data
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
  ): SelfFundingAlert | null {
    // Defensive: ensure we have required fields, using Decimal for precision
    const totalEquityDecimal = new Decimal(accountSummary.totalEquity ?? 0);
    const totalPnlDecimal = new Decimal(accountSummary.totalPnl ?? 0);
    const initialCapitalDecimal = new Decimal(initialCapital);

    // Calculate expected equity
    // Note: This formula might need adjustment based on how the platform
    // handles fees and funding rates. We're not currently subtracting
    // totalFeesPaid as it may already be included in totalPnl.
    const expectedEquityDecimal = initialCapitalDecimal.plus(totalPnlDecimal);
    const unexplainedAmountDecimal = totalEquityDecimal.minus(
      expectedEquityDecimal,
    );

    // Convert to numbers for comparisons and storage
    const totalEquity = totalEquityDecimal.toNumber();
    const expectedEquity = expectedEquityDecimal.toNumber();
    const unexplainedAmount = unexplainedAmountDecimal.toNumber();

    // Only flag if discrepancy exceeds threshold
    if (
      unexplainedAmountDecimal
        .abs()
        .lessThanOrEqualTo(this.config.reconciliationThreshold)
    ) {
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
      confidence: unexplainedAmountDecimal
        .abs()
        .greaterThan(this.config.criticalAmountThreshold)
        ? "high"
        : "medium",
      severity: unexplainedAmountDecimal
        .abs()
        .greaterThan(this.config.criticalAmountThreshold)
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
    detection: SelfFundingAlert,
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

      // Check if self-funding monitoring is enabled
      if (!config.selfFundingThresholdUsd) {
        // null/undefined means monitoring is disabled
        return false;
      }

      const threshold = parseFloat(config.selfFundingThresholdUsd);
      // Monitor if threshold is a valid number >= 0 (0 means any deposit is flagged)
      return !isNaN(threshold) && threshold >= 0;
    } catch (error) {
      serviceLogger.error(
        `[PerpsMonitoringService] Error checking competition config:`,
        error,
      );
      return false;
    }
  }
}
