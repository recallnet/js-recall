import { Decimal } from "decimal.js";
import { Logger } from "pino";

import { PerpsRepository } from "@recallnet/db/repositories/perps";
import {
  InsertPerpsSelfFundingAlert,
  InsertPerpsTransferHistory,
} from "@recallnet/db/schema/trading/types";

import {
  IPerpsDataProvider,
  PerpsAccountSummary,
  Transfer,
} from "./types/perps.js";

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
  private perpsRepo: PerpsRepository;
  private logger: Logger;
  // Default thresholds (in USD)
  // Competition rules: NO external deposits allowed during competition
  private static readonly DEFAULT_TRANSFER_THRESHOLD = 0; // Any deposit > $0 is suspicious
  private static readonly DEFAULT_RECONCILIATION_THRESHOLD = 100; // Unexplained > $100
  private static readonly DEFAULT_CRITICAL_THRESHOLD = 500; // Critical if > $500

  private readonly config: MonitoringConfig;

  constructor(
    private readonly provider: IPerpsDataProvider,
    perpsRepo: PerpsRepository,
    logger: Logger,
    config?: Partial<MonitoringConfig>,
  ) {
    this.perpsRepo = perpsRepo;
    this.logger = logger;

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

    this.logger.info(
      { config: this.config },
      `[PerpsMonitoringService] Initialized with provider: ${provider.getName()}`,
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

    this.logger.info(
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
        this.logger.error(
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
        await this.perpsRepo.batchCreatePerpsSelfFundingAlerts(alertsToCreate);
        totalAlertsCreated = alertsToCreate.length;

        this.logger.warn(
          `[PerpsMonitoringService] Created ${totalAlertsCreated} self-funding alerts`,
        );
      } catch (error) {
        this.logger.error(
          { error },
          `[PerpsMonitoringService] Failed to create alerts:`,
        );
      }
    }

    this.logger.info(
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
      const alertsMap = await this.perpsRepo.batchGetAgentsSelfFundingAlerts(
        agentIds,
        competitionId,
      );

      // The batch method returns Map<string, SelectPerpsSelfFundingAlert[]>
      // which is compatible since SelectPerpsSelfFundingAlert includes reviewed field
      return alertsMap;
    } catch (error) {
      this.logger.error(
        { error },
        `[PerpsMonitoringService] Failed to batch fetch alerts:`,
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
        this.logger.debug(
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
        this.logger.debug(
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
      this.logger.error(
        { error },
        `[PerpsMonitoringService] Error monitoring agent ${agent.agentId}:`,
      );
      throw error;
    }
  }

  /**
   * Check transfer history for deposits after competition start
   * Detects both individual large deposits and cumulative small deposits (structuring)
   * Also saves all transfers to database for violation detection
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

      // Save all transfers to database for violation detection and audit
      // NOTE: Mid-competition transfers are now PROHIBITED
      if (transfers.length > 0) {
        await this.saveTransferHistory(transfers, agentId, competitionId);
      }

      // Get ALL transfers (deposits or withdrawals) after competition start
      // These are ALL violations since mid-competition transfers are prohibited
      const violatingTransfers = transfers.filter(
        (t) =>
          new Date(t.timestamp) > competitionStartDate &&
          (t.to.toLowerCase() === walletAddress.toLowerCase() || // deposits
            t.from.toLowerCase() === walletAddress.toLowerCase()), // withdrawals
      );

      if (violatingTransfers.length === 0) {
        return null;
      }

      // Separate deposits and withdrawals for reporting
      const deposits = violatingTransfers.filter(
        (t) =>
          t.type === "deposit" &&
          t.to.toLowerCase() === walletAddress.toLowerCase(),
      );
      const withdrawals = violatingTransfers.filter(
        (t) =>
          t.type === "withdraw" &&
          t.from.toLowerCase() === walletAddress.toLowerCase(),
      );

      // Calculate totals using Decimal for precision
      const totalDeposited = deposits
        .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0))
        .toNumber();

      const totalWithdrawn = withdrawals
        .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0))
        .toNumber();

      // ALL mid-competition transfers are violations
      // Determine severity based on amount for prioritization
      const totalTransferred = totalDeposited + totalWithdrawn;

      // Confidence is always high since transfers are explicitly prohibited
      const confidence: "high" | "medium" | "low" = "high";

      // Build detailed note about the violation
      let note = `Mid-competition transfers are PROHIBITED. Found ${violatingTransfers.length} violation(s): `;
      if (deposits.length > 0) {
        note += `${deposits.length} deposit(s) totaling $${totalDeposited.toFixed(2)}`;
      }
      if (withdrawals.length > 0) {
        if (deposits.length > 0) note += " and ";
        note += `${withdrawals.length} withdrawal(s) totaling $${totalWithdrawn.toFixed(2)}`;
      }

      this.logger.warn(
        `[PerpsMonitoringService] Transfer violation detected for agent ${agentId}: ${note}`,
      );

      return {
        agentId,
        competitionId,
        expectedEquity: accountSummary.initialCapital ?? 0,
        actualEquity: accountSummary.totalEquity,
        unexplainedAmount: totalTransferred,
        detectionMethod: "transfer_history",
        confidence,
        severity:
          totalTransferred > this.config.criticalAmountThreshold
            ? "critical"
            : "warning",
        evidence: violatingTransfers, // Include ALL transfers as evidence
        note,
        accountSnapshot: accountSummary,
      };
    } catch (error) {
      this.logger.error(
        { error },
        `[PerpsMonitoringService] Error checking transfer history:`,
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

    this.logger.warn(
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
      const config =
        await this.perpsRepo.getPerpsCompetitionConfig(competitionId);
      if (!config) {
        this.logger.debug(
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
      this.logger.error(
        { error },
        `[PerpsMonitoringService] Error checking competition config:`,
      );
      return false;
    }
  }

  /**
   * Save transfers to database for violation detection and admin audit
   * NOTE: Mid-competition transfers are PROHIBITED
   */
  private async saveTransferHistory(
    transfers: Transfer[],
    agentId: string,
    competitionId: string,
  ): Promise<void> {
    try {
      // Transform Transfer objects to InsertPerpsTransferHistory format
      const transferRecords: InsertPerpsTransferHistory[] = transfers.map(
        (t, index) => ({
          agentId,
          competitionId,
          type: t.type,
          amount: t.amount.toString(),
          asset: t.asset,
          fromAddress: t.from,
          toAddress: t.to,
          txHash:
            t.txHash ||
            `${agentId}-${t.timestamp.toISOString()}-${t.type}-${t.amount}-${index}-${Date.now()}`, // Unique fallback including agentId, index, and timestamp
          chainId: t.chainId || 0, // Default to 0 if not provided
          transferTimestamp: t.timestamp,
        }),
      );

      // Batch save all transfers
      const saved =
        await this.perpsRepo.batchSaveTransferHistory(transferRecords);

      this.logger.info(
        `[PerpsMonitoringService] Saved ${saved.length} transfers for violation detection (agent ${agentId} in competition ${competitionId})`,
      );
    } catch (error) {
      // Log error but don't fail the monitoring process
      // Primary goal is violation detection, saving is for audit trail
      this.logger.error(
        { error },
        `[PerpsMonitoringService] Failed to save transfer history:`,
      );
    }
  }
}
