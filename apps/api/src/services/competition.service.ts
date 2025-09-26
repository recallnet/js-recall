import { v4 as uuidv4 } from "uuid";

import {
  SelectCompetition,
  SelectCompetitionReward,
  UpdateCompetition,
} from "@recallnet/db/schema/core/types";
import { SelectTrade } from "@recallnet/db/schema/trading/types";
import type { Transaction as DatabaseTransaction } from "@recallnet/db/types";

import { config } from "@/config/index.js";
import { buildPaginationResponse } from "@/controllers/request-helpers.js";
import { db } from "@/database/db.js";
import {
  findById as findAgentById,
  findByCompetition,
} from "@/database/repositories/agent-repository.js";
import { getAllAgentRanks } from "@/database/repositories/agentscore-repository.js";
import { resetAgentBalances } from "@/database/repositories/balance-repository.js";
import {
  addAgentToCompetition,
  batchInsertLeaderboard,
  create as createCompetition,
  findActive,
  findAll,
  findById,
  findByStatus,
  findCompetitionsNeedingEnding,
  findLeaderboardByTradingComp,
  get24hSnapshots,
  getAgentCompetitionRecord,
  getAllCompetitionAgents,
  getBatchVoteCounts,
  getBulkAgentCompetitionRecords,
  getBulkLatestPortfolioSnapshots,
  getCompetitionAgents,
  getEnrichedCompetitions,
  getLatestPortfolioSnapshots,
  isAgentActiveInCompetition,
  markCompetitionAsEnded,
  markCompetitionAsEnding,
  updateAgentCompetitionStatus,
  update as updateCompetition,
  updateOne,
} from "@/database/repositories/competition-repository.js";
import {
  createPerpsCompetitionConfig,
  deletePerpsCompetitionConfig,
  getCompetitionTransferViolationCounts,
  getPerpsCompetitionStats,
  getRiskAdjustedLeaderboard,
  updatePerpsCompetitionConfig,
} from "@/database/repositories/perps-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import { applySortingAndPagination, splitSortField } from "@/lib/sort.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { CompetitionRewardService } from "@/services/competition-reward.service.js";
import {
  AgentRankService,
  AgentService,
  BalanceService,
  ConfigurationService,
  PerpsDataProcessor,
  PortfolioSnapshotterService,
  TradeSimulatorService,
  TradingConstraintsService,
  VoteService,
} from "@/services/index.js";
import {
  CompetitionAgentStatus,
  CompetitionStatus,
  CompetitionType,
  CrossChainTradingType,
  PagingParams,
} from "@/types/index.js";
import {
  AgentComputedSortFields,
  AgentDbSortFields,
  AgentQueryParams,
} from "@/types/sort/agent.js";

interface TradingConstraintsInput {
  minimumPairAgeHours?: number;
  minimum24hVolumeUsd?: number;
  minimumLiquidityUsd?: number;
  minimumFdvUsd?: number;
}

/**
 * Represents an entry in a competition leaderboard
 */
interface LeaderboardEntry {
  agentId: string;
  value: number; // Portfolio value in USD
  pnl: number; // Profit/Loss amount (0 if not calculated)
  // Risk-adjusted metrics (optional, primarily for perps competitions)
  calmarRatio?: number | null;
  simpleReturn?: number | null;
  maxDrawdown?: number | null;
  hasRiskMetrics?: boolean; // Indicates if agent has risk metrics calculated
}

/**
 * Leaderboard data structure
 */
type LeaderboardData = {
  success: boolean;
  competition: SelectCompetition;
  leaderboard: Array<{
    rank: number;
    agentId: string;
    agentName: string;
    agentHandle: string;
    portfolioValue: number;
    active: boolean;
    deactivationReason: string | null;
    // Risk-adjusted metrics (primarily for perps competitions)
    calmarRatio?: number | null;
    simpleReturn?: number | null;
    maxDrawdown?: number | null;
    hasRiskMetrics?: boolean;
  }>;
  inactiveAgents: Array<{
    agentId: string;
    agentName: string;
    agentHandle: string;
    portfolioValue: number;
    active: boolean;
    deactivationReason: string | null;
  }>;
  hasInactiveAgents: boolean;
};

/**
 * Competition rules data structure
 */
type CompetitionRulesData = {
  success: boolean;
  competition: SelectCompetition;
  rules: {
    tradingRules: string[];
    rateLimits: string[];
    availableChains: {
      svm: boolean;
      evm: string[];
    };
    slippageFormula: string;
    tradingConstraints: {
      minimumPairAgeHours: number;
      minimum24hVolumeUsd: number;
      minimumLiquidityUsd: number;
      minimumFdvUsd: number;
      minTradesPerDay: number | null;
    };
  };
};

/**
 * Enriched competition data structure
 */
type EnrichedCompetition = SelectCompetition & {
  tradingConstraints?: {
    minimumPairAgeHours: number | null;
    minimum24hVolumeUsd: number | null;
    minimumLiquidityUsd: number | null;
    minimumFdvUsd: number | null;
    minTradesPerDay: number | null;
  };
  votingEnabled?: boolean;
  userVotingInfo?: {
    canVote: boolean;
    reason?: string;
    info: {
      hasVoted: boolean;
      agentId?: string;
      votedAt?: Date;
    };
  };
  totalVotes?: number;
};

/**
 * Enriched competitions list data structure
 */
type EnrichedCompetitionsData = {
  success: boolean;
  competitions: Array<EnrichedCompetition>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

/**
 * Competition details with enriched data
 */
type CompetitionDetailsData = {
  success: boolean;
  competition: SelectCompetition & {
    stats: {
      totalAgents: number;
      totalVotes: number;
      // Paper trading stats
      totalTrades?: number;
      totalVolume?: number;
      uniqueTokens?: number;
      // Perps stats
      totalPositions?: number;
    };
    tradingConstraints: {
      minimumPairAgeHours: number | null;
      minimum24hVolumeUsd: number | null;
      minimumLiquidityUsd: number | null;
      minimumFdvUsd: number | null;
      minTradesPerDay: number | null;
    };
    rewards: Array<{
      rank: number;
      reward: number;
      agentId: string | null;
    }>;
    votingEnabled?: boolean;
    userVotingInfo?: {
      canVote: boolean;
      reason?: string;
      info: {
        hasVoted: boolean;
        agentId?: string;
        votedAt?: Date;
      };
    };
  };
};

/**
 * Competition agents data structure
 */
type CompetitionAgentsData = {
  success: boolean;
  competitionId: string;
  registeredParticipants: number;
  maxParticipants: number | null;
  agents: Array<{
    id: string;
    name: string;
    handle: string;
    description: string | null;
    imageUrl: string | null;
    portfolioValue: number;
    active: boolean;
    deactivationReason: string | null;
    rank: number | null;
    score: number | null;
    voteCount: number;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

/**
 * Competition timeline data structure
 */
type CompetitionTimelineData = {
  success: boolean;
  competitionId: string;
  timeline: Array<{
    agentId: string;
    agentName: string;
    timeline: Array<{ timestamp: string; totalValue: number }>;
  }>;
};

/**
 * Trade data structure as returned by repository with agent info
 */
type TradeWithAgent = {
  id: string;
  competitionId: string | null;
  agentId: string;
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  fromTokenSymbol: string | null;
  toTokenSymbol: string | null;
  fromSpecificChain: string | null;
  toSpecificChain: string | null;
  tradeAmountUsd: number;
  timestamp: Date | null;
  reason: string | null;
  agent: {
    id: string;
    name: string;
    imageUrl: string | null;
    description: string | null;
  } | null;
};

/**
 * Competition trades data structure
 */
type CompetitionTradesData = {
  success: boolean;
  trades: TradeWithAgent[];
  competition: SelectCompetition;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

/**
 * Agent competition trades data structure
 */
type AgentCompetitionTradesData = {
  success: boolean;
  trades: SelectTrade[]; // Agent trades use basic SelectTrade format
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

/**
 * Leaderboard with inactive agents data structure
 */
interface LeaderboardWithInactiveAgents {
  activeAgents: Array<{
    agentId: string;
    value: number;
    calmarRatio?: number | null;
    simpleReturn?: number | null;
    maxDrawdown?: number | null;
    hasRiskMetrics?: boolean;
  }>;
  inactiveAgents: Array<{
    agentId: string;
    value: number;
    deactivationReason: string;
  }>;
}

/**
 * Basic competition info for unauthenticated users
 */
type BasicCompetitionInfo = {
  id: string;
  name: string;
  status: CompetitionStatus;
  externalUrl: string | null;
  imageUrl: string | null;
  startDate?: Date;
};

/**
 * Competition Service
 * Manages trading competitions with agent-based participation
 */
export class CompetitionService {
  private balanceService: BalanceService;
  private tradeSimulatorService: TradeSimulatorService;
  private portfolioSnapshotterService: PortfolioSnapshotterService;
  private agentService: AgentService;
  private configurationService: ConfigurationService;
  private agentRankService: AgentRankService;
  private voteService: VoteService;
  private tradingConstraintsService: TradingConstraintsService;
  private competitionRewardService: CompetitionRewardService;
  private perpsDataProcessor: PerpsDataProcessor;

  constructor(
    balanceService: BalanceService,
    tradeSimulatorService: TradeSimulatorService,
    portfolioSnapshotterService: PortfolioSnapshotterService,
    agentService: AgentService,
    configurationService: ConfigurationService,
    agentRankService: AgentRankService,
    voteService: VoteService,
    tradingConstraintsService: TradingConstraintsService,
    competitionRewardService: CompetitionRewardService,
    perpsDataProcessor: PerpsDataProcessor,
  ) {
    this.balanceService = balanceService;
    this.tradeSimulatorService = tradeSimulatorService;
    this.portfolioSnapshotterService = portfolioSnapshotterService;
    this.agentService = agentService;
    this.configurationService = configurationService;
    this.agentRankService = agentRankService;
    this.voteService = voteService;
    this.tradingConstraintsService = tradingConstraintsService;
    this.competitionRewardService = competitionRewardService;
    this.perpsDataProcessor = perpsDataProcessor;
  }

  /**
   * Create a new competition
   * @param name Competition name
   * @param description Optional description
   * @param tradingType Type of cross-chain trading to allow (defaults to disallowAll)
   * @param sandboxMode Whether to enable sandbox mode for auto-joining agents (defaults to false)
   * @param externalUrl Optional URL for external competition details
   * @param imageUrl Optional URL to the competition image
   * @param type Competition type (defaults to trading)
   * @param startDate Optional start date for the competition
   * @param endDate Optional end date for the competition
   * @param votingStartDate Optional voting start date
   * @param votingEndDate Optional voting end date
   * @param joinStartDate Optional start date for joining the competition
   * @param joinEndDate Optional end date for joining the competition
   * @param maxParticipants Optional maximum number of participants allowed
   * @param tradingConstraints Optional trading constraints for the competition
   * @param rewards Optional rewards for the competition
   * @returns The created competition
   */
  async createCompetition({
    name,
    description,
    tradingType,
    sandboxMode,
    externalUrl,
    imageUrl,
    type,
    startDate,
    endDate,
    votingStartDate,
    votingEndDate,
    joinStartDate,
    joinEndDate,
    maxParticipants,
    tradingConstraints,
    rewards,
    perpsProvider,
  }: {
    name: string;
    description?: string;
    tradingType?: CrossChainTradingType;
    sandboxMode?: boolean;
    externalUrl?: string;
    imageUrl?: string;
    type?: CompetitionType;
    startDate?: Date;
    endDate?: Date;
    votingStartDate?: Date;
    votingEndDate?: Date;
    joinStartDate?: Date;
    joinEndDate?: Date;
    maxParticipants?: number;
    tradingConstraints?: TradingConstraintsInput;
    rewards?: Record<number, number>;
    perpsProvider?: {
      provider: "symphony" | "hyperliquid";
      initialCapital: number; // Required - Zod default ensures this is set
      selfFundingThreshold: number; // Required - Zod default ensures this is set
      apiUrl?: string;
    };
  }) {
    const id = uuidv4();

    const competition: Parameters<typeof createCompetition>[0] = {
      id,
      name,
      description,
      externalUrl,
      imageUrl,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      votingStartDate: votingStartDate ?? null,
      votingEndDate: votingEndDate ?? null,
      joinStartDate: joinStartDate ?? null,
      joinEndDate: joinEndDate ?? null,
      maxParticipants: maxParticipants ?? null,
      status: "pending",
      crossChainTradingType: tradingType ?? "disallowAll",
      sandboxMode: sandboxMode ?? false,
      type: type ?? "trading",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Execute all operations in a single transaction
    const result = await db.transaction(async (tx) => {
      // Create the competition
      await createCompetition(competition, tx);

      // Create perps competition config if it's a perps competition
      if (type === "perpetual_futures") {
        // Validate that perpsProvider is provided for perps competitions
        if (!perpsProvider) {
          throw new ApiError(
            400,
            "Perps provider configuration is required for perpetual futures competitions",
          );
        }

        const perpsConfig = {
          competitionId: id,
          dataSource: "external_api" as const,
          dataSourceConfig: {
            type: "external_api" as const,
            provider: perpsProvider.provider,
            apiUrl: perpsProvider.apiUrl,
          },
          initialCapital: perpsProvider.initialCapital.toString(),
          selfFundingThresholdUsd:
            perpsProvider.selfFundingThreshold.toString(),
        };

        await createPerpsCompetitionConfig(perpsConfig, tx);
        serviceLogger.debug(
          `[CompetitionService] Created perps config for competition ${id}: ${JSON.stringify(perpsConfig)}`,
        );
      }

      let createdRewards: SelectCompetitionReward[] = [];
      if (rewards) {
        createdRewards = await this.competitionRewardService.createRewards(
          id,
          rewards,
          tx,
        );
        serviceLogger.debug(
          `[CompetitionManager] Created rewards for competition ${id}: ${JSON.stringify(
            createdRewards,
          )}`,
        );
      }

      // Always create trading constraints (with defaults if not provided)
      const constraints =
        await this.tradingConstraintsService.createConstraints(
          {
            competitionId: id,
            ...tradingConstraints,
          },
          tx,
        );
      serviceLogger.debug(
        `[CompetitionManager] Created trading constraints for competition ${id}`,
      );

      return {
        competition,
        createdRewards,
        constraints,
      };
    });

    serviceLogger.debug(
      `[CompetitionManager] Created competition: ${name} (${id}), crossChainTradingType: ${tradingType}, type: ${type}}`,
    );

    return {
      ...result.competition,
      rewards: result.createdRewards.map((reward) => ({
        rank: reward.rank,
        reward: reward.reward,
      })),
      tradingConstraints: {
        minimumPairAgeHours: result.constraints?.minimumPairAgeHours,
        minimum24hVolumeUsd: result.constraints?.minimum24hVolumeUsd,
        minimumLiquidityUsd: result.constraints?.minimumLiquidityUsd,
        minimumFdvUsd: result.constraints?.minimumFdvUsd,
      },
    };
  }

  /**
   * Get a competition by ID
   * @param competitionId The competition ID
   * @returns The competition or null if not found
   */
  async getCompetition(competitionId: string) {
    return findById(competitionId);
  }

  /**
   * Get all competitions
   * @returns Array of all competitions
   */
  async getAllCompetitions() {
    return findAll();
  }

  /**
   * Start a competition.
   * For all agents in the competition, resets their portfolio balances to starting values,
   * ensures they are registered and active in the competition, and takes an initial portfolio
   * snapshot.  If the operation fails midway through, some of this can be left incomplete, but
   * each step is idempotent and can be safely retried until the competition starts successfully.
   * @param competitionId The competition ID
   * @param agentIds Array of agent IDs participating in the competition
   * @param tradingConstraints Optional trading constraints for the competition
   * @returns The updated competition
   */
  async startCompetition(
    competitionId: string,
    agentIds: string[],
    tradingConstraints?: TradingConstraintsInput,
  ) {
    const competition = await findById(competitionId);
    if (!competition) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    if (competition.status !== "pending") {
      throw new Error(`Competition cannot be started: ${competition.status}`);
    }

    const activeCompetition = await findActive();
    if (activeCompetition) {
      throw new Error(
        `Another competition is already active: ${activeCompetition.id}`,
      );
    }

    // Process all agent additions and activations
    for (const agentId of agentIds) {
      // Handle balances based on competition type
      if (competition.type === "trading") {
        // Paper trading: Reset to standard balances (5k USDC per chain)
        await this.balanceService.resetAgentBalances(agentId);
      } else if (competition.type === "perpetual_futures") {
        // Perps: Clear all balances to prevent confusion
        // Pass empty Map to delete all balances without creating new ones
        await resetAgentBalances(agentId, new Map());
        serviceLogger.debug(
          `[CompetitionService] Cleared balances for perps agent ${agentId}`,
        );
      }

      // Ensure agent is globally active (but don't force reactivation)
      const agent = await findAgentById(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      if (agent.status !== "active") {
        throw new Error(
          `Cannot start competition with agent ${agentId}: agent status is ${agent.status}`,
        );
      }

      // Register agent in the competition (automatically sets status to 'active')
      try {
        await addAgentToCompetition(competitionId, agentId);
      } catch (error) {
        // If participant limit error, provide a more helpful error message
        if (
          error instanceof Error &&
          error.message.includes("maximum participant limit")
        ) {
          throw new Error(
            `Cannot start competition: ${error.message}. Some agents may already be registered.`,
          );
        }
        throw error;
      }

      serviceLogger.debug(
        `[CompetitionManager] Agent ${agentId} ready for competition`,
      );
    }

    // Set up trading constraints before taking snapshots
    const existingConstraints =
      await this.tradingConstraintsService.getConstraints(competitionId);
    let newConstraints = existingConstraints;
    if (tradingConstraints && existingConstraints) {
      // If the caller provided constraints and they already exist, we update
      newConstraints = await this.tradingConstraintsService.updateConstraints(
        competitionId,
        tradingConstraints,
      );
      serviceLogger.debug(
        `[CompetitionManager] Updating trading constraints for competition ${competitionId}`,
      );
    } else if (!existingConstraints) {
      // if the constraints don't exist, we create them with defaults and
      // (optionally) caller provided values.
      newConstraints =
        (await this.tradingConstraintsService.createConstraints({
          competitionId,
          ...tradingConstraints,
        })) || null;
    }

    // Take initial portfolio snapshots BEFORE setting status to active
    // This ensures no trades can happen during snapshot initialization
    // Different approach based on competition type:
    if (competition.type === "trading") {
      // Paper trading: Use portfolio snapshotter with reset balances
      serviceLogger.debug(
        `[CompetitionService] Taking initial paper trading portfolio snapshots for ${agentIds.length} agents (competition still pending)`,
      );
      await this.portfolioSnapshotterService.takePortfolioSnapshots(
        competitionId,
      );
      serviceLogger.debug(
        `[CompetitionService] Initial paper trading portfolio snapshots completed`,
      );
    } else if (competition.type === "perpetual_futures") {
      // Perps: Sync from Symphony to get initial $500 balance state
      serviceLogger.debug(
        `[CompetitionService] Syncing initial perps data from Symphony for ${agentIds.length} agents (competition still pending)`,
      );

      const result =
        await this.perpsDataProcessor.processPerpsCompetition(competitionId);

      const successCount = result.syncResult.successful.length;
      const failedCount = result.syncResult.failed.length;
      const totalCount = successCount + failedCount;

      serviceLogger.debug(
        `[CompetitionService] Initial perps sync completed: ${successCount}/${totalCount} agents synced successfully`,
      );

      if (failedCount > 0) {
        // Log which agents failed but don't throw - some agents may not have Symphony accounts yet
        const failedAgentIds = result.syncResult.failed.map((f) => f.agentId);
        serviceLogger.warn(
          `[CompetitionService] Failed to sync ${failedCount} out of ${totalCount} agents during competition start: ${failedAgentIds.join(", ")}`,
        );
      }
    } else {
      throw new Error(`Unknown competition type: ${competition.type}`);
    }

    // NOW update the competition status to active
    // This opens trading and price endpoint access to agents
    const finalCompetition = await updateCompetition({
      id: competitionId,
      status: "active",
      startDate: new Date(),
      updatedAt: new Date(),
    });

    serviceLogger.debug(
      `[CompetitionManager] Started competition: ${competition.name} (${competitionId})`,
    );
    serviceLogger.debug(
      `[CompetitionManager] Participating agents: ${agentIds.join(", ")}`,
    );

    // Reload competition-specific configuration settings
    await this.configurationService.loadCompetitionSettings();
    serviceLogger.debug(`[CompetitionManager] Reloaded configuration settings`);

    return {
      ...finalCompetition,
      tradingConstraints: {
        minimumPairAgeHours: newConstraints?.minimumPairAgeHours,
        minimum24hVolumeUsd: newConstraints?.minimum24hVolumeUsd,
        minimumLiquidityUsd: newConstraints?.minimumLiquidityUsd,
        minimumFdvUsd: newConstraints?.minimumFdvUsd,
      },
    };
  }

  /**
   * Calculates final leaderboard, enriches with PnL data, and persists to database
   * @param competitionId The competition ID
   * @param totalAgents Total number of agents in the competition
   * @param tx Database transaction
   * @returns Number of leaderboard entries that were saved
   */
  private async calculateAndPersistFinalLeaderboard(
    competitionId: string,
    totalAgents: number,
    tx: DatabaseTransaction,
  ): Promise<number> {
    // Get the leaderboard (calculated from final snapshots)
    const leaderboard = await this.getLeaderboard(competitionId);

    const enrichedEntries = [];

    // Note: the leaderboard array could be quite large, avoiding Promise.all
    // so that these async calls to get pnl happen in series and don't over
    // use system resources.
    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      if (entry === undefined) continue;

      const { pnl, startingValue } =
        await this.agentService.getAgentPerformanceForComp(
          entry.agentId,
          competitionId,
        );

      enrichedEntries.push({
        agentId: entry.agentId,
        competitionId,
        rank: i + 1, // 1-based ranking
        pnl,
        startingValue,
        totalAgents,
        score: entry.value, // Portfolio value in USD is saved as `score`
      });
    }

    // Persist to database
    if (enrichedEntries.length > 0) {
      await batchInsertLeaderboard(enrichedEntries, tx);
    }

    return enrichedEntries.length;
  }

  /**
   * End a competition
   * @param competitionId The competition ID
   * @returns The updated competition
   */
  async endCompetition(competitionId: string) {
    // Mark as ending (active -> ending) - this returns the competition object
    let competition = await markCompetitionAsEnding(competitionId);

    if (!competition) {
      const current = await findById(competitionId);
      if (!current) {
        throw new Error(`Competition not found: ${competitionId}`);
      }
      if (current.status === "ended") {
        return current; // Already ended
      }
      if (current.status !== "ending") {
        throw new Error(
          `Competition is not active or ending: ${current.status}`,
        );
      }
      // If "ending", continue processing (retry scenario)
      // In retry scenario, use the current competition we already fetched
      competition = current;
    }

    serviceLogger.debug(
      `[CompetitionManager] Marked competition as ending: ${competitionId}`,
    );

    // Take final data snapshot based on competition type
    // force=true ensures we get final values even though status is ENDED
    if (competition.type === "trading") {
      // Paper trading: Take portfolio snapshots from balances
      await this.portfolioSnapshotterService.takePortfolioSnapshots(
        competitionId,
        true,
      );
      serviceLogger.debug(
        `[CompetitionService] Final paper trading portfolio snapshots completed`,
      );
    } else if (competition.type === "perpetual_futures") {
      // Perps: Sync final data from Symphony
      // This fetches final account summaries and positions, creating portfolio snapshots
      const result =
        await this.perpsDataProcessor.processPerpsCompetition(competitionId);
      const successCount = result.syncResult.successful.length;
      const failedCount = result.syncResult.failed.length;
      const totalCount = successCount + failedCount;
      serviceLogger.debug(
        `[CompetitionService] Final perps sync completed: ${successCount}/${totalCount} agents synced successfully`,
      );
      if (failedCount > 0) {
        // Log warning but don't fail the competition ending
        serviceLogger.warn(
          `[CompetitionService] Failed to sync final data for ${failedCount} out of ${totalCount} agents in ending competition`,
        );
      }
    } else {
      serviceLogger.warn(
        `[CompetitionService] Unknown competition type ${competition.type} - skipping final snapshot`,
      );
    }

    // Get agents in the competition (outside transaction - they won't change)
    const competitionAgents = await getCompetitionAgents(competitionId);

    // Reload configuration settings (revert to environment defaults)
    await this.configurationService.loadCompetitionSettings();

    // Final transaction to persist results
    const { competition: finalCompetition, leaderboardCount } =
      await db.transaction(async (tx) => {
        // Mark as ended. This is our guard against concurrent execution - if another process is
        // ending the same competition in parallel, only one will manage to mark it as ended, and
        // the other one's transaction will fail.
        const updated = await markCompetitionAsEnded(competitionId, tx);
        if (!updated) {
          throw new Error(
            "Competition was already ended or not in ending state",
          );
        }

        // Calculate final leaderboard, enrich with PnL data, and persist to database
        const leaderboardCount = await this.calculateAndPersistFinalLeaderboard(
          competitionId,
          competitionAgents.length,
          tx,
        );

        // Update agent ranks based on competition results
        await this.agentRankService.updateAgentRanksForCompetition(
          competitionId,
          tx,
        );

        return { competition: updated, leaderboardCount };
      });

    // Log success only after transaction has committed
    serviceLogger.debug(
      `[CompetitionManager] Competition ended successfully: ${competition.name} (${competitionId}) - ` +
        `${competitionAgents.length} agents, ${leaderboardCount} leaderboard entries`,
    );

    return finalCompetition;
  }

  /**
   * Check if a competition is active
   * @param competitionId The competition ID
   * @returns True if the competition is active
   */
  async isCompetitionActive(competitionId: string) {
    const competition = await findById(competitionId);
    return competition?.status === "active";
  }

  /**
   * Get the currently active competition
   * @returns The active competition or null if none
   */
  async getActiveCompetition() {
    return findActive();
  }

  /**
   * Check if the active competition is of a specific type (atomic operation)
   * @param type The competition type to check
   * @returns true if active competition matches the type, false otherwise
   */
  async isActiveCompetitionType(
    type: "trading" | "perpetual_futures",
  ): Promise<boolean> {
    const activeCompetition = await findActive();
    return activeCompetition?.type === type;
  }

  /**
   * Check if a specific competition is of a given type (atomic operation)
   * @param competitionId The competition ID to check
   * @param type The competition type to check
   * @returns Object with exists (if competition exists) and isType (if it matches the type)
   */
  async checkCompetitionType(
    competitionId: string,
    type: "trading" | "perpetual_futures",
  ): Promise<{ exists: boolean; isType: boolean }> {
    const competition = await findById(competitionId);
    return {
      exists: !!competition,
      isType: competition?.type === type,
    };
  }

  /**
   * Get the agents in a competition and attach relevant metrics
   * @param competitionId The competition ID
   * @returns Array of agent IDs
   */
  async getCompetitionAgentsWithMetrics(
    competitionId: string,
    queryParams: AgentQueryParams,
  ) {
    const { sort: originalSort, limit, offset } = queryParams;
    const { dbSort, computedSort } = splitSortField(
      originalSort,
      AgentDbSortFields,
      AgentComputedSortFields,
    );
    const dbQueryParams = {
      ...queryParams,
      sort: dbSort,
    };
    const isComputedSort = computedSort !== undefined;
    const { agents, total } = await findByCompetition(
      competitionId,
      dbQueryParams,
      isComputedSort,
    );

    // Get leaderboard data for the competition to get scores and ranks
    const leaderboard = await this.getLeaderboard(competitionId);
    const leaderboardMap = new Map(
      leaderboard.map((entry, index) => [
        entry.agentId,
        { score: entry.value, rank: index + 1 },
      ]),
    );

    // Get vote counts for all agents in this competition
    const voteCountsMap =
      await this.voteService.getVoteCountsByCompetition(competitionId);

    // Build the response with agent details and competition data using bulk metrics
    const agentIds = agents.map((agent) => agent.id);
    const currentValues = new Map(
      agents.map((agent) => {
        const leaderboardData = leaderboardMap.get(agent.id);
        const score = leaderboardData?.score ?? 0;
        return [agent.id, score];
      }),
    );

    // Calculate metrics for all agents efficiently using bulk method
    const bulkMetrics = await this.calculateBulkAgentMetrics(
      competitionId,
      agentIds,
      currentValues,
    );

    // Build the response with agent details and competition data
    const competitionAgents = agents.map((agent) => {
      const isActive = agent.status === "active";
      const leaderboardData = leaderboardMap.get(agent.id);
      const leaderboardEntry = leaderboard.find(
        (entry) => entry.agentId === agent.id,
      );
      const score = leaderboardData?.score ?? 0;
      const rank = leaderboardData?.rank ?? 0;
      const voteCount = voteCountsMap.get(agent.id) ?? 0;
      const metrics = bulkMetrics.get(agent.id) || {
        pnl: 0,
        pnlPercent: 0,
        change24h: 0,
        change24hPercent: 0,
      };

      return {
        id: agent.id,
        name: agent.name,
        handle: agent.handle,
        description: agent.description,
        imageUrl: agent.imageUrl,
        score,
        active: isActive,
        deactivationReason: !isActive ? agent.deactivationReason : null,
        rank,
        portfolioValue: score,
        pnl: metrics.pnl,
        pnlPercent: metrics.pnlPercent,
        change24h: metrics.change24h,
        change24hPercent: metrics.change24hPercent,
        voteCount,
        // Risk metrics from leaderboard (perps competitions only)
        calmarRatio: leaderboardEntry?.calmarRatio ?? null,
        simpleReturn: leaderboardEntry?.simpleReturn ?? null,
        maxDrawdown: leaderboardEntry?.maxDrawdown ?? null,
        hasRiskMetrics: leaderboardEntry?.hasRiskMetrics ?? false,
      };
    });

    // Apply post-processing sorting and pagination, if needed
    const finalCompetitionAgents = isComputedSort
      ? applySortingAndPagination(
          competitionAgents,
          computedSort,
          limit,
          offset,
        )
      : competitionAgents;

    return {
      agents: finalCompetitionAgents,
      total,
    };
  }

  /**
   * Calculates leaderboard from the latest portfolio snapshots
   * @param competitionId The competition ID
   * @returns Leaderboard entries sorted by portfolio value (descending)
   */
  private async calculateLeaderboardFromSnapshots(
    competitionId: string,
  ): Promise<LeaderboardEntry[]> {
    const snapshots = await getLatestPortfolioSnapshots(competitionId);
    if (snapshots.length === 0) {
      return [];
    }

    // Check competition type to determine if we need risk metrics
    const competition = await findById(competitionId);

    if (competition?.type === "perpetual_futures") {
      // For perps: Fetch risk-adjusted leaderboard which includes risk metrics
      const riskAdjustedLeaderboard = await getRiskAdjustedLeaderboard(
        competitionId,
        500, // Reasonable limit
        0,
      );

      // Create a map for quick lookups
      const riskMetricsMap = new Map(
        riskAdjustedLeaderboard.map((entry) => [
          entry.agentId,
          {
            calmarRatio: entry.calmarRatio ? Number(entry.calmarRatio) : null,
            simpleReturn: entry.simpleReturn
              ? Number(entry.simpleReturn)
              : null,
            maxDrawdown: entry.maxDrawdown ? Number(entry.maxDrawdown) : null,
            hasRiskMetrics: entry.hasRiskMetrics,
          },
        ]),
      );

      // Combine snapshot data with risk metrics
      return snapshots
        .map((snapshot) => {
          const riskMetrics = riskMetricsMap.get(snapshot.agentId) || {
            calmarRatio: null,
            simpleReturn: null,
            maxDrawdown: null,
            hasRiskMetrics: false,
          };

          return {
            agentId: snapshot.agentId,
            value: snapshot.totalValue,
            pnl: 0, // PnL not available from snapshots alone
            ...riskMetrics,
          };
        })
        .sort((a, b) => b.value - a.value);
    }

    // For paper trading: Return without risk metrics
    return snapshots
      .map((snapshot) => ({
        agentId: snapshot.agentId,
        value: snapshot.totalValue,
        pnl: 0, // PnL not available from snapshots alone
        calmarRatio: null,
        simpleReturn: null,
        maxDrawdown: null,
        hasRiskMetrics: false,
      }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Calculates leaderboard from current live portfolio values
   * @param competitionId The competition ID
   * @returns Leaderboard entries sorted by portfolio value (descending)
   */
  private async calculateLeaderboardFromLivePortfolios(
    competitionId: string,
  ): Promise<LeaderboardEntry[]> {
    // Check competition type to determine data source
    const competition = await findById(competitionId);

    if (competition?.type === "perpetual_futures") {
      // For perps: Use a single-query method that combines risk metrics and equity
      // This uses lateral joins to get everything in one DB query, already sorted correctly:
      // 1. Agents with Calmar ratio (sorted by Calmar DESC)
      // 2. Agents without Calmar ratio (sorted by equity DESC)

      const riskAdjustedLeaderboard = await getRiskAdjustedLeaderboard(
        competitionId,
        500, // Reasonable limit - most competitions won't have more agents
        0,
      );

      // Transform to LeaderboardEntry format, including risk metrics
      return riskAdjustedLeaderboard.map((entry) => ({
        agentId: entry.agentId,
        value: Number(entry.totalEquity) || 0,
        pnl: Number(entry.totalPnl) || 0,
        // Include risk-adjusted metrics
        calmarRatio: entry.calmarRatio ? Number(entry.calmarRatio) : null,
        simpleReturn: entry.simpleReturn ? Number(entry.simpleReturn) : null,
        maxDrawdown: entry.maxDrawdown ? Number(entry.maxDrawdown) : null,
        hasRiskMetrics: entry.hasRiskMetrics,
      }));
    }

    // For paper trading: Use existing balance-based calculation
    const agents = await getCompetitionAgents(competitionId);

    // Use bulk portfolio value calculation
    const portfolioValues =
      await this.tradeSimulatorService.calculateBulkPortfolioValues(agents);

    const leaderboard = agents.map((agentId: string) => ({
      agentId,
      value: portfolioValues.get(agentId) || 0,
      pnl: 0, // PnL not available without historical data
      // Risk metrics not applicable for paper trading
      calmarRatio: null,
      simpleReturn: null,
      maxDrawdown: null,
      hasRiskMetrics: false,
    }));

    // Sort by value descending
    return leaderboard.sort((a, b) => b.value - a.value);
  }

  /**
   * Calculates a leaderboard for pending competitions based on global agent rankings
   * @param competitionId The competition ID
   * @returns Leaderboard entries sorted by global ranking score
   */
  private async calculatePendingCompetitionLeaderboard(
    competitionId: string,
  ): Promise<LeaderboardEntry[]> {
    const agents = await getCompetitionAgents(competitionId);
    const globalLeaderboard = await getAllAgentRanks(agents);

    // Create map of agent IDs to their global rank scores
    const globalLeaderboardMap = new Map(
      globalLeaderboard.map((agent) => [agent.id, agent.score]),
    );

    return agents
      .map((agentId: string) => ({
        agentId,
        value: 0, // No portfolio value for pending competitions
        pnl: 0,
        globalScore: globalLeaderboardMap.get(agentId) ?? -1, // Use -1 for unranked agents
      }))
      .sort((a, b) => b.globalScore - a.globalScore)
      .map(({ agentId, value, pnl }) => ({
        agentId,
        value,
        pnl,
        // Risk metrics not available for pending competitions
        calmarRatio: null,
        simpleReturn: null,
        maxDrawdown: null,
        hasRiskMetrics: false,
      }));
  }

  /**
   * Retrieves or calculates the leaderboard for a competition
   *
   * The method follows this precedence order based on competition status:
   * - PENDING: Returns agents sorted by global ranking (no portfolio values)
   * - ENDED: Returns saved leaderboard from database, or calculates from snapshots if recently ended
   * - ACTIVE: Calculates from portfolio snapshots, or live values as fallback
   *
   * @param competitionId The unique identifier of the competition
   * @returns Promise resolving to an array of leaderboard entries sorted by value (highest first)
   * @throws Will not throw - returns empty array on errors (logs the error)
   */
  async getLeaderboard(competitionId: string): Promise<LeaderboardEntry[]> {
    try {
      const competition = await findById(competitionId);
      if (!competition) {
        serviceLogger.warn(
          `[CompetitionManager] Competition ${competitionId} not found`,
        );
        return [];
      }

      switch (competition.status) {
        case "pending":
          return await this.calculatePendingCompetitionLeaderboard(
            competitionId,
          );

        case "ended": {
          // Try saved leaderboard first
          const savedLeaderboard =
            await findLeaderboardByTradingComp(competitionId);
          if (savedLeaderboard.length > 0) {
            return savedLeaderboard;
          }

          serviceLogger.debug(
            `[CompetitionManager] No saved leaderboard found for ended competition ${competitionId}, calculating from snapshots`,
          );
          // Fall through to calculate from snapshots
        }

        case "active":
        case "ending": {
          // Try snapshots first
          const snapshotLeaderboard =
            await this.calculateLeaderboardFromSnapshots(competitionId);
          if (snapshotLeaderboard.length > 0) {
            return snapshotLeaderboard;
          }

          serviceLogger.debug(
            `[CompetitionManager] No snapshots found for competition ${competitionId}, calculating from live portfolio values`,
          );
          // Fallback to live calculation
          return await this.calculateLeaderboardFromLivePortfolios(
            competitionId,
          );
        }

        default:
          serviceLogger.warn(
            `[CompetitionManager] Unknown competition status: ${competition.status}`,
          );
          return [];
      }
    } catch (error) {
      serviceLogger.error(
        `[CompetitionManager] Error getting leaderboard for competition ${competitionId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get leaderboard data including both active and inactive agents
   * @param competitionId The competition ID
   * @returns Object containing active agents (with rankings) and inactive agents (with deactivation reasons)
   */
  async getLeaderboardWithInactiveAgents(
    competitionId: string,
  ): Promise<LeaderboardWithInactiveAgents> {
    try {
      // Get active leaderboard (already filtered to active agents only)
      const activeLeaderboard = await this.getLeaderboard(competitionId);

      // Get all agents who have ever participated in this competition
      const allCompetitionAgentIds =
        await this.getAllCompetitionAgents(competitionId);

      // Create set of active agent IDs for efficient lookup
      const activeAgentIds = new Set(
        activeLeaderboard.map((entry) => entry.agentId),
      );

      // Find inactive agent IDs
      const inactiveAgentIds = allCompetitionAgentIds.filter(
        (agentId) => !activeAgentIds.has(agentId),
      );

      let inactiveAgents: Array<{
        agentId: string;
        value: number;
        deactivationReason: string;
      }> = [];
      if (inactiveAgentIds.length > 0) {
        // 🚀 BULK OPERATIONS: Fetch all inactive agent data
        const [competitionRecords, latestSnapshots] = await Promise.all([
          getBulkAgentCompetitionRecords(competitionId, inactiveAgentIds),
          getBulkLatestPortfolioSnapshots(competitionId, inactiveAgentIds),
        ]);

        // Create lookup maps for efficient data joining
        const competitionRecordsMap = new Map(
          competitionRecords.map((record) => [record.agentId, record]),
        );
        const latestPortfolioValues = new Map(
          latestSnapshots.map((snapshot) => [
            snapshot.agentId,
            snapshot.totalValue ?? 0,
          ]),
        );

        // Build inactive agents array efficiently
        inactiveAgents = inactiveAgentIds.map((agentId) => {
          const competitionRecord = competitionRecordsMap.get(agentId);
          const deactivationReason =
            competitionRecord?.deactivationReason ||
            "Not actively participating in this competition";
          const portfolioValue = latestPortfolioValues.get(agentId) || 0;

          return {
            agentId,
            value: portfolioValue,
            deactivationReason,
          };
        });

        serviceLogger.debug(
          `[CompetitionManager] Successfully retrieved ${inactiveAgents.length} inactive agents using bulk operations`,
        );
      }

      return {
        activeAgents: activeLeaderboard.map((entry) => ({
          agentId: entry.agentId,
          value: entry.value,
          calmarRatio: entry.calmarRatio,
          simpleReturn: entry.simpleReturn,
          maxDrawdown: entry.maxDrawdown,
          hasRiskMetrics: entry.hasRiskMetrics,
        })),
        inactiveAgents,
      };
    } catch (error) {
      serviceLogger.error(
        `[CompetitionManager] Error getting leaderboard with inactive agents for competition ${competitionId}:`,
        error,
      );
      // Re-throw the error so callers can handle it appropriately
      // This prevents silent failures that could mislead users
      throw new Error(
        `Failed to retrieve leaderboard data for competition ${competitionId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Calculate PnL and 24h change metrics for multiple agents in a competition efficiently
   * This replaces the N+1 query pattern of calling calculateAgentMetrics in a loop
   *
   * @param competitionId The competition ID
   * @param agentIds Array of agent IDs to calculate metrics for
   * @param currentValues Map of agent ID to current portfolio value
   * @returns Map of agent ID to metrics object
   */
  async calculateBulkAgentMetrics(
    competitionId: string,
    agentIds: string[],
    currentValues: Map<string, number>,
  ): Promise<
    Map<
      string,
      {
        pnl: number;
        pnlPercent: number;
        change24h: number;
        change24hPercent: number;
      }
    >
  > {
    if (agentIds.length === 0) {
      return new Map();
    }

    serviceLogger.debug(
      `[CompetitionManager] Calculating bulk metrics for ${agentIds.length} agents in competition ${competitionId}`,
    );

    try {
      // Get only the snapshots we need for metrics calculation
      const { earliestSnapshots, snapshots24hAgo } = await get24hSnapshots(
        competitionId,
        agentIds,
      );

      // Create maps for efficient lookup
      const earliestSnapshotsMap = new Map(
        earliestSnapshots.map((snapshot) => [snapshot.agentId, snapshot]),
      );
      const snapshots24hAgoMap = new Map(
        snapshots24hAgo.map((snapshot) => [snapshot.agentId, snapshot]),
      );

      // Calculate metrics for each agent
      const metricsMap = new Map();

      for (const agentId of agentIds) {
        const currentValue = currentValues.get(agentId) || 0;
        const earliestSnapshot = earliestSnapshotsMap.get(agentId);
        const snapshot24hAgo = snapshots24hAgoMap.get(agentId);

        // Default values
        let pnl = 0;
        let pnlPercent = 0;
        let change24h = 0;
        let change24hPercent = 0;

        // Calculate PnL from earliest snapshot
        if (earliestSnapshot) {
          const startingValue = earliestSnapshot.totalValue;
          if (startingValue > 0) {
            pnl = currentValue - startingValue;
            pnlPercent = (pnl / startingValue) * 100;
          }
        }

        // Calculate 24h change from closest snapshot to 24h ago
        if (snapshot24hAgo) {
          const value24hAgo = snapshot24hAgo.totalValue;
          if (value24hAgo > 0) {
            change24h = currentValue - value24hAgo;
            change24hPercent = (change24h / value24hAgo) * 100;
          }
        }

        metricsMap.set(agentId, {
          pnl,
          pnlPercent,
          change24h,
          change24hPercent,
        });
      }

      serviceLogger.debug(
        `[CompetitionManager] Successfully calculated bulk metrics for ${agentIds.length} agents`,
      );
      return metricsMap;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionManager] Error in calculateBulkAgentMetrics:`,
        error,
      );

      throw new ApiError(
        500,
        `Failed to calculate bulk metrics: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Check if competition manager is healthy
   * For system health check use
   */
  async isHealthy() {
    try {
      // Simple check to see if we can connect to the database
      await findAll();
      return true;
    } catch (error) {
      serviceLogger.error("[CompetitionManager] Health check failed:", error);
      return false;
    }
  }

  /**
   * Get all upcoming (pending) competitions
   * @returns Object with competitions array and total count
   * TODO(stbrody): add caching
   */
  async getUpcomingCompetitions() {
    return findByStatus({
      status: "pending",
      params: {
        sort: "",
        limit: 100,
        offset: 0,
      },
    });
  }

  /**
   * Get all competitions with a given status and pagination parameters
   * @param status The status of the competitions to get
   * @param pagingParams The paging parameters to use
   * @returns Object containing competitions array and total count for pagination
   */
  async getCompetitions(
    status: CompetitionStatus | undefined,
    pagingParams: PagingParams,
  ) {
    return await findByStatus({
      status,
      params: pagingParams,
    });
  }

  /**
   * Update a competition
   * @param competitionId The competition ID
   * @param updates The core competition fields to update
   * @param tradingConstraints Optional trading constraints to update
   * @param rewards Optional rewards to replace
   * @param perpsProvider Optional perps provider config (required when changing to perps type)
   * @returns The updated competition with constraints and rewards
   */
  async updateCompetition(
    competitionId: string,
    updates: UpdateCompetition,
    tradingConstraints?: TradingConstraintsInput,
    rewards?: Record<number, number>,
    perpsProvider?: {
      provider: "symphony" | "hyperliquid";
      initialCapital: number; // Required - Zod default ensures this is set
      selfFundingThreshold: number; // Required - Zod default ensures this is set
      apiUrl?: string;
    },
  ): Promise<{
    competition: SelectCompetition;
    updatedRewards: SelectCompetitionReward[];
  }> {
    // Get the existing competition
    const existingCompetition = await findById(competitionId);
    if (!existingCompetition) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    // If perpsProvider is provided but type is not, auto-set type to perpetual_futures
    if (perpsProvider && !updates.type) {
      updates.type = "perpetual_futures";
    }

    // Check if type is being changed
    const isTypeChanging =
      updates.type !== undefined && updates.type !== existingCompetition.type;

    if (isTypeChanging) {
      // Only allow type changes for pending competitions
      if (existingCompetition.status !== "pending") {
        throw new ApiError(
          400,
          `Cannot change competition type once it has started. Current status: ${existingCompetition.status}`,
        );
      }

      // Validate perps provider is provided when converting to perps
      if (updates.type === "perpetual_futures" && !perpsProvider) {
        throw new ApiError(
          400,
          "Perps provider configuration is required when changing to perpetual futures type",
        );
      }
    }

    // Execute all updates in a single transaction
    const result = await db.transaction(async (tx) => {
      // Handle type conversion if needed
      if (isTypeChanging && updates.type) {
        const oldType = existingCompetition.type;
        const newType = updates.type;

        serviceLogger.info(
          `[CompetitionService] Converting competition ${competitionId} from ${oldType} to ${newType}`,
        );

        if (oldType === "trading" && newType === "perpetual_futures") {
          // Spot → Perps: Create perps config (after checking for existing)
          // At this point we know perpsProvider exists because we validated above
          if (!perpsProvider) {
            throw new ApiError(
              500,
              "Internal error: perps provider missing despite validation",
            );
          }

          // First, delete any existing perps config (defensive programming for data inconsistency)
          // This handles the edge case where a "trading" competition somehow has perps config
          const deleted = await deletePerpsCompetitionConfig(competitionId, tx);
          if (deleted) {
            serviceLogger.warn(
              `[CompetitionService] Deleted unexpected existing perps config for trading competition ${competitionId}`,
            );
          }

          const perpsConfig = {
            competitionId,
            dataSource: "external_api" as const,
            dataSourceConfig: {
              type: "external_api" as const,
              provider: perpsProvider.provider,
              apiUrl: perpsProvider.apiUrl,
            },
            initialCapital: perpsProvider.initialCapital.toString(),
            selfFundingThresholdUsd:
              perpsProvider.selfFundingThreshold.toString(),
          };

          await createPerpsCompetitionConfig(perpsConfig, tx);
          serviceLogger.debug(
            `[CompetitionService] Created perps config for converted competition ${competitionId}`,
          );
        } else if (oldType === "perpetual_futures" && newType === "trading") {
          // Perps → Spot: Delete perps config using repository method
          await deletePerpsCompetitionConfig(competitionId, tx);
          serviceLogger.debug(
            `[CompetitionService] Deleted perps config for converted competition ${competitionId}`,
          );
        }
      } else if (
        existingCompetition.type === "perpetual_futures" &&
        perpsProvider
      ) {
        // Update perps config for existing perps competition
        serviceLogger.info(
          `[CompetitionService] Updating perps config for competition ${competitionId}`,
        );

        const updatedConfig = await updatePerpsCompetitionConfig(
          competitionId,
          {
            dataSourceConfig: {
              type: "external_api" as const,
              provider: perpsProvider.provider,
              apiUrl: perpsProvider.apiUrl,
            },
            initialCapital: perpsProvider.initialCapital.toString(),
            selfFundingThresholdUsd:
              perpsProvider.selfFundingThreshold.toString(),
          },
          tx,
        );

        if (!updatedConfig) {
          serviceLogger.warn(
            `[CompetitionService] No perps config found to update for competition ${competitionId}`,
          );
        } else {
          serviceLogger.debug(
            `[CompetitionService] Updated perps config for competition ${competitionId}: ` +
              `threshold=${perpsProvider.selfFundingThreshold}, ` +
              `capital=${perpsProvider.initialCapital}`,
          );
        }
      }

      // Update the competition
      const updatedCompetition = await updateOne(competitionId, updates, tx);

      // Update trading constraints if provided
      if (tradingConstraints) {
        await this.tradingConstraintsService.updateConstraints(
          competitionId,
          tradingConstraints,
          tx,
        );
      }

      // Replace rewards if provided
      let updatedRewards: SelectCompetitionReward[] = [];
      if (rewards) {
        updatedRewards = await this.competitionRewardService.replaceRewards(
          competitionId,
          rewards,
          tx,
        );
      }

      return { competition: updatedCompetition, updatedRewards };
    });

    serviceLogger.debug(
      `[CompetitionService] Updated competition: ${competitionId}`,
    );

    return result;
  }

  /**
   * Join an agent to a competition.  Note that in the sandbox this is handled by the admin
   * controller via the sandbox proxy.  If agents were to ever be added to the sandbox competition
   * via this function, it would need to be updated to handle the sandbox mode logic (reseting
   * balances, taking initial snapshot, etc.)
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @param userId Optional user ID from session authentication
   * @param authenticatedAgentId Optional agent ID from API key authentication
   */
  async joinCompetition(
    competitionId: string,
    agentId: string,
    userId?: string,
    authenticatedAgentId?: string,
  ): Promise<void> {
    serviceLogger.debug(
      `[CompetitionManager] Join competition request: agent ${agentId} to competition ${competitionId}`,
    );

    // Validate authentication
    if (!authenticatedAgentId && !userId) {
      throw new ApiError(401, "Authentication required");
    }

    if (authenticatedAgentId) {
      // Agent API key authentication
      if (authenticatedAgentId !== agentId) {
        throw new ApiError(403, "Agent API key does not match agent ID in URL");
      }
    }

    // Check if agent exists and validate ownership
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new ApiError(404, `Agent not found: ${agentId}`);
    }

    // Complete authentication validation and get validated user ID
    let validatedUserId: string;
    if (authenticatedAgentId) {
      // For agent API key auth, set the validated user ID from the agent
      validatedUserId = agent.ownerId;
    } else if (userId) {
      // For user session auth, verify ownership
      if (agent.ownerId !== userId) {
        throw new ApiError(403, "Access denied: You do not own this agent");
      }
      validatedUserId = userId;
    } else {
      // This shouldn't happen due to earlier check, but TypeScript needs this
      throw new ApiError(401, "Authentication required");
    }

    // Check if competition exists
    const competition = await findById(competitionId);
    if (!competition) {
      throw new ApiError(404, `Competition not found: ${competitionId}`);
    }

    // Check join date constraints FIRST (must take precedence over other errors)
    const now = new Date();

    if (competition.joinStartDate && now < competition.joinStartDate) {
      throw new ApiError(
        403,
        `Competition joining opens at ${competition.joinStartDate.toISOString()}`,
      );
    }

    if (competition.joinEndDate && now > competition.joinEndDate) {
      throw new ApiError(
        403,
        `Competition joining closed at ${competition.joinEndDate.toISOString()}`,
      );
    }

    // Check agent status is eligible
    if (agent.status === "deleted" || agent.status === "suspended") {
      throw new ApiError(403, "Agent is not eligible to join competitions");
    }

    // Check if competition status is pending
    if (competition.status !== "pending") {
      throw new ApiError(
        403,
        "Cannot join competition that has already started/ended",
      );
    }

    // Check if agent is already actively registered
    const isAlreadyActive = await isAgentActiveInCompetition(
      competitionId,
      agentId,
    );
    if (isAlreadyActive) {
      throw new ApiError(
        403,
        "Agent is already actively registered for this competition",
      );
    }

    // Atomically add agent to competition with participant limit check
    // This prevents race conditions when multiple agents try to join simultaneously
    try {
      await addAgentToCompetition(competitionId, agentId);
    } catch (error) {
      // Convert repository error to appropriate API error
      if (
        error instanceof Error &&
        error.message.includes("maximum participant limit")
      ) {
        throw new ApiError(403, error.message);
      }
      throw error;
    }

    serviceLogger.debug(
      `[CompetitionManager] Successfully joined agent ${agentId} to competition ${competitionId} for user ${validatedUserId}`,
    );
  }

  /**
   * Remove an agent from a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @param userId Optional user ID from session authentication
   * @param authenticatedAgentId Optional agent ID from API key authentication
   */
  async leaveCompetition(
    competitionId: string,
    agentId: string,
    userId?: string,
    authenticatedAgentId?: string,
  ): Promise<void> {
    serviceLogger.debug(
      `[CompetitionManager] Leave competition request: agent ${agentId} from competition ${competitionId}`,
    );

    // Validate authentication
    if (!authenticatedAgentId && !userId) {
      throw new ApiError(401, "Authentication required");
    }

    if (authenticatedAgentId) {
      // Agent API key authentication
      if (authenticatedAgentId !== agentId) {
        throw new ApiError(403, "Agent API key does not match agent ID in URL");
      }
    }

    // Check if agent exists and validate ownership
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new ApiError(404, `Agent not found: ${agentId}`);
    }

    // Complete authentication validation and get validated user ID
    let validatedUserId: string;
    if (authenticatedAgentId) {
      // For agent API key auth, set the validated user ID from the agent
      validatedUserId = agent.ownerId;
    } else if (userId) {
      // For user session auth, verify ownership
      if (agent.ownerId !== userId) {
        throw new ApiError(403, "Access denied: You do not own this agent");
      }
      validatedUserId = userId;
    } else {
      // This shouldn't happen due to earlier check, but TypeScript needs this
      throw new ApiError(401, "Authentication required");
    }

    // Check if competition exists
    const competition = await findById(competitionId);
    if (!competition) {
      throw new ApiError(404, `Competition not found: ${competitionId}`);
    }

    // Check if agent is in the competition (any status)
    const isInCompetition = await this.isAgentInCompetition(
      competitionId,
      agentId,
    );
    if (!isInCompetition) {
      throw new ApiError(403, "Agent is not in this competition");
    }

    // Handle based on competition status
    if (competition.status === "ended") {
      throw new ApiError(
        403,
        "Cannot leave competition that has already ended",
      );
    } else if (competition.status === "active") {
      // During active competition: mark agent as withdrawn from this competition
      await updateAgentCompetitionStatus(
        competitionId,
        agentId,
        "withdrawn",
        `Withdrew from competition ${competition.name}`,
      );
      serviceLogger.debug(
        `[CompetitionManager] Marked agent ${agentId} as withdrawn from active competition ${competitionId}`,
      );
    } else if (competition.status === "pending") {
      // During pending competition: mark as withdrawn (preserving history)
      await updateAgentCompetitionStatus(
        competitionId,
        agentId,
        "withdrawn",
        `Withdrew from competition ${competition.name} before it started`,
      );
      serviceLogger.debug(
        `[CompetitionManager] Marked agent ${agentId} as left from pending competition ${competitionId}`,
      );
    }

    serviceLogger.debug(
      `[CompetitionManager] Successfully processed leave request for agent ${agentId} from competition ${competitionId} for user ${validatedUserId}`,
    );
  }

  /**
   * Check if an agent is in a competition (any status)
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @returns True if agent is in competition, false otherwise
   */
  async isAgentInCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<boolean> {
    // Use the repository method to check if agent has any record in the competition
    const record = await getAgentCompetitionRecord(competitionId, agentId);
    return record !== null;
  }

  /**
   * Remove an agent from a competition (admin operation)
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @param reason Optional reason for removal
   */
  async removeAgentFromCompetition(
    competitionId: string,
    agentId: string,
    reason?: string,
  ): Promise<void> {
    // Check if agent is in the competition
    const isInCompetition = await this.isAgentInCompetition(
      competitionId,
      agentId,
    );
    if (!isInCompetition) {
      throw new Error("Agent is not in this competition");
    }

    // Get competition details
    const competition = await findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    // Update agent status in competition to 'disqualified'
    await updateAgentCompetitionStatus(
      competitionId,
      agentId,
      "disqualified",
      reason || "Disqualified by admin",
    );

    serviceLogger.debug(
      `[CompetitionManager] Admin removed agent ${agentId} from competition ${competitionId}`,
    );
  }

  /**
   * Reactivate an agent in a competition (admin operation)
   * @param competitionId The competition ID
   * @param agentId The agent ID
   */
  async reactivateAgentInCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<void> {
    // Check if agent is in the competition
    const isInCompetition = await this.isAgentInCompetition(
      competitionId,
      agentId,
    );
    if (!isInCompetition) {
      throw new Error("Agent is not in this competition");
    }

    // Get competition details
    const competition = await findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    // Update agent status in competition to 'active'
    await updateAgentCompetitionStatus(
      competitionId,
      agentId,
      "active",
      "Reactivated by admin",
    );

    serviceLogger.debug(
      `[CompetitionManager] Admin reactivated agent ${agentId} in competition ${competitionId}`,
    );
  }

  /**
   * Check if an agent is actively participating in a competition
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @returns True if agent is actively participating, false otherwise
   */
  async isAgentActiveInCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<boolean> {
    return await isAgentActiveInCompetition(competitionId, agentId);
  }

  /**
   * Get an agent's competition record with deactivation details
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @returns The agent's competition record or null if not found
   */
  async getAgentCompetitionRecord(
    competitionId: string,
    agentId: string,
  ): Promise<{
    status: CompetitionAgentStatus;
    deactivationReason: string | null;
    deactivatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    return await getAgentCompetitionRecord(competitionId, agentId);
  }

  /**
   * Get all agents that have ever participated in a competition, regardless of status
   * This is useful for retrieving portfolio snapshots for all agents including inactive ones
   * @param competitionId The competition ID
   * @returns Array of agent IDs
   */
  async getAllCompetitionAgents(competitionId: string): Promise<string[]> {
    return await getAllCompetitionAgents(competitionId);
  }

  /**
   * Check and automatically end competitions that have reached their end date
   */
  async processCompetitionEndDateChecks(): Promise<void> {
    try {
      const competitionsToEnd = await findCompetitionsNeedingEnding();

      if (competitionsToEnd.length === 0) {
        serviceLogger.debug(
          "[CompetitionManager] No competitions ready to end",
        );
        return;
      }

      serviceLogger.debug(
        `[CompetitionManager] Found ${competitionsToEnd.length} competitions ready to end`,
      );

      for (const competition of competitionsToEnd) {
        try {
          serviceLogger.debug(
            `[CompetitionManager] Auto-ending competition: ${competition.name} (${competition.id}) - scheduled end: ${competition.endDate!.toISOString()} - status: ${competition.status}`,
          );

          await this.endCompetition(competition.id);

          serviceLogger.debug(
            `[CompetitionManager] Successfully auto-ended competition: ${competition.name} (${competition.id})`,
          );
        } catch (error) {
          serviceLogger.error(
            `[CompetitionManager] Error auto-ending competition ${competition.id}: ${error instanceof Error ? error : String(error)}`,
          );
          // Continue processing other competitions even if one fails
        }
      }
    } catch (error) {
      serviceLogger.error(
        `[CompetitionManager] Error in processCompetitionEndDateChecks: ${error instanceof Error ? error : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get leaderboard with authorization checks
   * @param params Parameters for leaderboard request
   * @returns Leaderboard data with proper authorization
   */
  async getLeaderboardWithAuthorization(params: {
    competitionId?: string;
    agentId?: string;
    isAdmin?: boolean;
  }): Promise<LeaderboardData> {
    try {
      // Get active competition or use provided competitionId
      const competitionId =
        params.competitionId || (await this.getActiveCompetition())?.id;

      if (!competitionId) {
        throw new ApiError(
          400,
          "No active competition and no competitionId provided",
        );
      }

      // Check if competition exists
      const competition = await this.getCompetition(competitionId);
      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Authentication and Authorization
      if (params.isAdmin) {
        // Admin access: Log and proceed
        serviceLogger.debug(
          `Admin accessing leaderboard for competition ${competitionId}.`,
        );
      } else {
        // Not an admin, an agentId is required
        if (!params.agentId) {
          throw new ApiError(
            401,
            "Authentication required to view leaderboard",
          );
        }
        // AgentId is present, verify active participation
        const isAgentActive = await this.isAgentActiveInCompetition(
          competitionId,
          params.agentId,
        );
        if (!isAgentActive) {
          throw new ApiError(
            403,
            "Forbidden: Your agent is not actively participating in this competition.",
          );
        }
      }

      // Get leaderboard data (active and inactive agents)
      const leaderboardData =
        await this.getLeaderboardWithInactiveAgents(competitionId);

      // Get only the agents that are in this competition
      const competitionAgentIds = [
        ...leaderboardData.activeAgents.map((entry) => entry.agentId),
        ...leaderboardData.inactiveAgents.map((entry) => entry.agentId),
      ];
      const agents =
        await this.agentService.getAgentsByIds(competitionAgentIds);
      const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

      // Build active leaderboard with ranks
      const activeLeaderboard = leaderboardData.activeAgents.map(
        (entry, index) => {
          const agent = agentMap.get(entry.agentId);
          return {
            rank: index + 1,
            agentId: entry.agentId,
            agentName: agent ? agent.name : "Unknown Agent",
            agentHandle: agent ? agent.handle : "unknown_agent",
            portfolioValue: entry.value,
            active: true,
            deactivationReason: null,
            // Include risk metrics if available
            calmarRatio: entry.calmarRatio,
            simpleReturn: entry.simpleReturn,
            maxDrawdown: entry.maxDrawdown,
            hasRiskMetrics: entry.hasRiskMetrics,
          };
        },
      );

      // Build inactive agents list
      const inactiveAgents = leaderboardData.inactiveAgents.map((entry) => {
        const agent = agentMap.get(entry.agentId);
        return {
          agentId: entry.agentId,
          agentName: agent ? agent.name : "Unknown Agent",
          agentHandle: agent ? agent.handle : "unknown_agent",
          portfolioValue: entry.value,
          active: false,
          deactivationReason: entry.deactivationReason,
        };
      });

      const result = {
        success: true,
        competition,
        leaderboard: activeLeaderboard,
        inactiveAgents: inactiveAgents,
        hasInactiveAgents: inactiveAgents.length > 0,
      };

      return result;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting leaderboard with authorization:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get competition status with participation info
   * @param agentId Optional agent ID for participation check
   * @param isAdmin Whether the requester is an admin
   * @returns Competition status with authorization-based information
   */
  async getCompetitionStatus(
    agentId?: string,
    isAdmin?: boolean,
  ): Promise<{
    success: boolean;
    active: boolean;
    competition: SelectCompetition | null | BasicCompetitionInfo;
    isAdmin?: boolean;
    participating?: boolean;
    message?: string;
  }> {
    try {
      // Get active competition
      const activeCompetition = await this.getActiveCompetition();

      // If no active competition, return null status
      if (!activeCompetition) {
        serviceLogger.debug("[CompetitionService] No active competition found");
        return {
          success: true,
          active: false,
          competition: null,
          message: "No active competition found",
        };
      }

      serviceLogger.debug(
        `[CompetitionService] Found active competition: ${activeCompetition.id}`,
      );

      // If admin, return full status
      if (isAdmin) {
        serviceLogger.debug(
          `[CompetitionService] Admin ${agentId} accessing competition status`,
        );
        return {
          success: true,
          active: true,
          competition: activeCompetition,
          isAdmin: true,
          participating: false,
        };
      }

      // If not authenticated, just return basic status
      const basicInfo = {
        id: activeCompetition.id,
        name: activeCompetition.name,
        status: activeCompetition.status,
        externalUrl: activeCompetition.externalUrl,
        imageUrl: activeCompetition.imageUrl,
      };

      if (!agentId) {
        return {
          success: true,
          active: true,
          competition: basicInfo,
          message: "Authentication required to check participation status",
        };
      }

      // Check if the agent is actively participating in the competition
      const isAgentActiveInCompetitionResult =
        await this.isAgentActiveInCompetition(activeCompetition.id, agentId);

      // If agent is not actively participating, return limited info
      if (!isAgentActiveInCompetitionResult) {
        serviceLogger.debug(
          `[CompetitionService] Agent ${agentId} is not in competition ${activeCompetition.id}`,
        );

        return {
          success: true,
          active: true,
          competition: {
            ...basicInfo,
            startDate: activeCompetition.startDate || undefined,
          },
          participating: false,
          message: "Your agent is not participating in this competition",
        };
      }

      // Agent is participating
      serviceLogger.debug(
        `[CompetitionService] Agent ${agentId} is participating in competition ${activeCompetition.id}`,
      );

      // Return full competition info
      return {
        success: true,
        active: true,
        competition: activeCompetition,
        participating: true,
      };
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting competition status:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get competition rules for the active competition as a participant
   * @param params Parameters for rules request
   * @returns Formatted competition rules
   */
  async getCompetitionRules(params: {
    agentId?: string;
    isAdmin?: boolean;
  }): Promise<CompetitionRulesData> {
    try {
      // Get active competition first, as rules are always for the active one
      const activeCompetition = await this.getActiveCompetition();

      if (!activeCompetition) {
        throw new ApiError(
          404,
          "No active competition found to get rules for.",
        );
      }

      // Authentication and Authorization
      if (params.isAdmin) {
        // Admin access: Log and proceed
        serviceLogger.debug(
          `Admin accessing rules for competition ${activeCompetition.id}.`,
        );
      } else {
        // Not an admin, an agentId is required
        if (!params.agentId) {
          throw new ApiError(
            401,
            "Authentication required to view competition rules: Agent ID missing.",
          );
        }
        // AgentId is present, verify participation in the active competition
        if (activeCompetition.status !== "active") {
          throw new ApiError(
            400,
            "No active competition found to get rules for.",
          );
        }
        const isAgentActive = await this.isAgentActiveInCompetition(
          activeCompetition.id,
          params.agentId,
        );
        if (!isAgentActive) {
          throw new ApiError(
            403,
            "Forbidden: Your agent is not actively participating in this competition.",
          );
        }
      }

      // Build initial balances description based on config
      const initialBalanceDescriptions = [];

      // Chain-specific balances
      for (const chain of Object.keys(config.specificChainBalances)) {
        const chainBalances =
          config.specificChainBalances[
            chain as keyof typeof config.specificChainBalances
          ];
        const tokenItems = [];

        for (const token of Object.keys(chainBalances)) {
          const amount = chainBalances[token];
          if (amount && amount > 0) {
            tokenItems.push(`${amount} ${token.toUpperCase()}`);
          }
        }

        if (tokenItems.length > 0) {
          let chainName = chain;
          // Format chain name for better readability
          if (chain === "eth") chainName = "Ethereum";
          else if (chain === "svm") chainName = "Solana";
          else chainName = chain.charAt(0).toUpperCase() + chain.slice(1); // Capitalize

          initialBalanceDescriptions.push(
            `${chainName}: ${tokenItems.join(", ")}`,
          );
        }
      }

      // Get trading constraints for the active competition
      const tradingConstraints =
        await this.tradingConstraintsService.getConstraintsWithDefaults(
          activeCompetition.id,
        );

      // Define base rules
      const tradingRules = [
        "Trading is only allowed for tokens with valid price data",
        `All agents start with identical token balances: ${initialBalanceDescriptions.join("; ")}`,
        "Minimum trade amount: 0.000001 tokens",
        `Maximum single trade: ${config.maxTradePercentage}% of agent's total portfolio value`,
        "No shorting allowed (trades limited to available balance)",
        "Slippage is applied to all trades based on trade size",
        `Cross-chain trading type: ${activeCompetition.crossChainTradingType}`,
        "Transaction fees are not simulated",
        `Token eligibility requires minimum ${tradingConstraints.minimumPairAgeHours} hours of trading history`,
        `Token must have minimum 24h volume of $${tradingConstraints.minimum24hVolumeUsd.toLocaleString()} USD`,
        `Token must have minimum liquidity of $${tradingConstraints.minimumLiquidityUsd.toLocaleString()} USD`,
        `Token must have minimum FDV of $${tradingConstraints.minimumFdvUsd.toLocaleString()} USD`,
      ];

      // Add minimum trades per day rule if set
      if (tradingConstraints.minTradesPerDay !== null) {
        tradingRules.push(
          `Minimum trades per day requirement: ${tradingConstraints.minTradesPerDay} trades`,
        );
      }

      const rateLimits = [
        `${config.rateLimiting.maxRequests} requests per ${config.rateLimiting.windowMs / 1000} seconds per endpoint`,
        "100 requests per minute for trade operations",
        "300 requests per minute for price queries",
        "30 requests per minute for balance/portfolio checks",
        "3,000 requests per minute across all endpoints",
        "10,000 requests per hour per agent",
      ];

      const availableChains = {
        svm: true,
        evm: config.evmChains,
      };

      const slippageFormula =
        "baseSlippage = (tradeAmountUSD / 10000) * 0.05%, actualSlippage = baseSlippage * (0.9 + (Math.random() * 0.2))";

      // Assemble all rules
      const allRules = {
        tradingRules,
        rateLimits,
        availableChains,
        slippageFormula,
        tradingConstraints,
      };

      const result = {
        success: true,
        competition: activeCompetition,
        rules: allRules,
      };

      return result;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting competition rules:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get upcoming competitions with authentication check
   * @param agentId Optional agent ID for authentication
   * @param isAdmin Whether the requester is an admin
   * @returns Upcoming competitions
   */
  async getUpcomingCompetitionsWithAuth(
    agentId?: string,
    isAdmin?: boolean,
  ): Promise<SelectCompetition[]> {
    try {
      // Authentication check
      if (!isAdmin && !agentId) {
        throw new ApiError(401, "Authentication required");
      }

      if (isAdmin) {
        serviceLogger.debug(
          `[CompetitionService] Admin ${agentId} requesting upcoming competitions`,
        );
      } else {
        serviceLogger.debug(
          `[CompetitionService] Agent ${agentId} requesting upcoming competitions`,
        );
      }

      // Get upcoming competitions
      const result = await this.getUpcomingCompetitions();

      return result.competitions;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting upcoming competitions with auth:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get enriched competitions with user voting data
   * @param params Parameters for competitions request
   * @returns Enriched competitions list
   */
  async getEnrichedCompetitions(params: {
    status?: CompetitionStatus;
    pagingParams: PagingParams;
    userId?: string;
    agentId?: string;
    isAdmin?: boolean;
  }): Promise<EnrichedCompetitionsData> {
    try {
      // Get competitions
      const { competitions, total } = await this.getCompetitions(
        params.status,
        params.pagingParams,
      );

      // If user is authenticated, enrich competitions with voting information
      let enrichedCompetitions = competitions;
      if (params.userId) {
        const competitionIds = competitions.map((c) => c.id);

        // Fetch all data in parallel with batch queries
        const [enrichmentData, voteCountsMap] = await Promise.all([
          getEnrichedCompetitions(params.userId, competitionIds),
          getBatchVoteCounts(competitionIds),
        ]);

        // Create lookup maps for efficient access
        const enrichmentMap = new Map(
          enrichmentData.map((data) => [data.competitionId, data]),
        );

        enrichedCompetitions = competitions.map((competition) => {
          const enrichment = enrichmentMap.get(competition.id);
          if (!enrichment) {
            throw new ApiError(500, "invalid competition state");
          }

          const hasVoted = !!enrichment.userVoteAgentId;
          const compVotingStatus =
            this.voteService.checkCompetitionVotingEligibility(competition);

          const votingState = {
            canVote: compVotingStatus.canVote,
            reason: compVotingStatus.reason,
            info: {
              hasVoted,
              agentId: enrichment.userVoteAgentId || undefined,
              votedAt: enrichment.userVoteCreatedAt || undefined,
            },
          };

          const totalVotes = voteCountsMap.get(competition.id)?.totalVotes || 0;

          const tradingConstraints = {
            minimumPairAgeHours: enrichment.minimumPairAgeHours,
            minimum24hVolumeUsd: enrichment.minimum24hVolumeUsd,
            minimumLiquidityUsd: enrichment.minimumLiquidityUsd,
            minimumFdvUsd: enrichment.minimumFdvUsd,
            minTradesPerDay: enrichment.minTradesPerDay,
          };

          return {
            ...competition,
            tradingConstraints,
            votingEnabled: votingState.canVote || votingState.info.hasVoted,
            userVotingInfo: votingState,
            totalVotes,
          };
        });
      }

      // Calculate hasMore based on total and current page
      const hasMore =
        params.pagingParams.offset + params.pagingParams.limit < total;

      const result = {
        success: true,
        competitions: enrichedCompetitions,
        pagination: {
          total: total,
          limit: params.pagingParams.limit,
          offset: params.pagingParams.offset,
          hasMore: hasMore,
        },
      };

      return result;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting enriched competitions:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get competition by ID with caching and authorization
   * @param params Parameters for competition request
   * @returns Competition details with enriched data
   */
  async getCompetitionById(params: {
    competitionId: string;
    userId?: string;
    agentId?: string;
    isAdmin?: boolean;
  }): Promise<CompetitionDetailsData> {
    try {
      // Fetch all data pieces first
      const [
        competition,
        tradeMetrics,
        voteCountsMap,
        rewards,
        tradingConstraints,
        votingState,
      ] = await Promise.all([
        // Get competition details
        this.getCompetition(params.competitionId),
        // Get trade metrics for this competition
        this.tradeSimulatorService.getCompetitionTradeMetrics(
          params.competitionId,
        ),
        // Get vote counts for this competition
        this.voteService.getVoteCountsByCompetition(params.competitionId),
        // Get reward structure
        this.competitionRewardService.getRewardsByCompetition(
          params.competitionId,
        ),
        // Get trading constraints
        this.tradingConstraintsService.getConstraintsWithDefaults(
          params.competitionId,
        ),
        // Get voting state if user is authenticated
        params.userId
          ? this.voteService.getCompetitionVotingState(
              params.userId,
              params.competitionId,
            )
          : Promise.resolve(null),
      ]);

      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Calculate total votes
      const totalVotes = Array.from(voteCountsMap.values()).reduce(
        (sum, count) => sum + count,
        0,
      );

      // Build stats based on competition type
      let stats: {
        totalAgents: number;
        totalVotes: number;
        totalTrades?: number;
        totalVolume?: number;
        uniqueTokens?: number;
        totalPositions?: number;
      };

      if (competition.type === "perpetual_futures") {
        // For perps competitions, get perps-specific stats
        const perpsStatsData = await getPerpsCompetitionStats(
          params.competitionId,
        );
        stats = {
          totalAgents: competition.registeredParticipants,
          totalVotes,
          totalPositions: perpsStatsData?.totalPositions ?? 0,
        };
      } else {
        // For paper trading competitions, include trade metrics
        stats = {
          totalTrades: tradeMetrics.totalTrades,
          totalAgents: competition.registeredParticipants,
          totalVolume: tradeMetrics.totalVolume,
          totalVotes,
          uniqueTokens: tradeMetrics.uniqueTokens,
        };
      }

      // Format rewards
      const formattedRewards = rewards.map((r) => ({
        rank: r.rank,
        reward: r.reward,
        agentId: r.agentId,
      }));

      // Assemble final response
      const result = {
        success: true,
        competition: {
          ...competition,
          stats,
          tradingConstraints,
          rewards: formattedRewards,
          votingEnabled: votingState
            ? votingState.canVote || votingState.info.hasVoted
            : false,
          userVotingInfo: votingState || undefined,
        },
      };

      return result;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting competition by ID with auth:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get competition agents with caching
   * @param params Parameters for agents request
   * @returns Competition agents with pagination
   */
  async getCompetitionAgents(params: {
    competitionId: string;
    queryParams: {
      limit: number;
      offset: number;
      sortBy?: string;
      sortOrder?: string;
    };
  }): Promise<CompetitionAgentsData> {
    try {
      // Get competition
      const competition = await this.getCompetition(params.competitionId);
      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Get agents for this competition with sorting and pagination
      const { agents, total } = await this.getCompetitionAgentsWithMetrics(
        params.competitionId,
        params.queryParams,
      );

      const result = {
        success: true,
        competitionId: params.competitionId,
        registeredParticipants: competition.registeredParticipants,
        maxParticipants: competition.maxParticipants,
        agents,
        pagination: buildPaginationResponse(
          total,
          params.queryParams.limit,
          params.queryParams.offset,
        ),
      };

      return result;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting competition agents with auth:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get competition timeline with caching
   * @param competitionId The competition ID
   * @param bucket Time bucket interval in minutes
   * @returns Competition timeline data
   */
  async getCompetitionTimeline(
    competitionId: string,
    bucket: number,
  ): Promise<CompetitionTimelineData> {
    try {
      // Get competition
      const competition = await this.getCompetition(competitionId);
      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Get timeline data from portfolio snapshotter
      const rawData =
        await this.portfolioSnapshotterService.getAgentPortfolioTimeline(
          competitionId,
          bucket,
        );

      // Transform into the required structure
      const agentsMap = new Map<
        string,
        {
          agentId: string;
          agentName: string;
          timeline: Array<{ timestamp: string; totalValue: number }>;
        }
      >();

      for (const item of rawData) {
        if (!agentsMap.has(item.agentId)) {
          agentsMap.set(item.agentId, {
            agentId: item.agentId,
            agentName: item.agentName,
            timeline: [],
          });
        }

        agentsMap.get(item.agentId)!.timeline.push({
          timestamp: item.timestamp,
          totalValue: item.totalValue,
        });
      }

      const result = {
        success: true,
        competitionId,
        timeline: Array.from(agentsMap.values()),
      };

      return result;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting competition timeline with auth:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get rules for a specific competition by competition ID.
   * @param competitionId The competition ID
   * @returns Competition rules
   */
  async getRulesForSpecificCompetition(
    competitionId: string,
  ): Promise<CompetitionRulesData> {
    try {
      // Get competition
      const competition = await this.getCompetition(competitionId);
      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Get trading constraints
      const tradingConstraints =
        await this.tradingConstraintsService.getConstraintsWithDefaults(
          competition.id,
        );

      // Build initial balances description based on config (original logic)
      const initialBalanceDescriptions = [];

      // Chain-specific balances
      for (const chain of Object.keys(config.specificChainBalances)) {
        const chainBalances =
          config.specificChainBalances[
            chain as keyof typeof config.specificChainBalances
          ];
        const tokenItems = [];

        for (const token of Object.keys(chainBalances)) {
          const amount = chainBalances[token];
          if (amount && amount > 0) {
            tokenItems.push(`${amount} ${token.toUpperCase()}`);
          }
        }

        if (tokenItems.length > 0) {
          let chainName = chain;
          // Format chain name for better readability
          if (chain === "eth") chainName = "Ethereum";
          else if (chain === "svm") chainName = "Solana";
          else chainName = chain.charAt(0).toUpperCase() + chain.slice(1); // Capitalize

          initialBalanceDescriptions.push(
            `${chainName}: ${tokenItems.join(", ")}`,
          );
        }
      }

      // Define base rules (same logic as getRules but for specific competition)
      const tradingRules = [
        "Trading is only allowed for tokens with valid price data",
        `All agents start with identical token balances: ${initialBalanceDescriptions.join("; ")}`,
        "Minimum trade amount: 0.000001 tokens",
        `Maximum single trade: ${config.maxTradePercentage}% of agent's total portfolio value`,
        "No shorting allowed (trades limited to available balance)",
        "Slippage is applied to all trades based on trade size",
        `Cross-chain trading type: ${competition.crossChainTradingType}`,
        "Transaction fees are not simulated",
        `Token eligibility requires minimum ${tradingConstraints.minimumPairAgeHours} hours of trading history`,
        `Token must have minimum 24h volume of $${tradingConstraints.minimum24hVolumeUsd.toLocaleString()} USD`,
        `Token must have minimum liquidity of $${tradingConstraints.minimumLiquidityUsd.toLocaleString()} USD`,
        `Token must have minimum FDV of $${tradingConstraints.minimumFdvUsd.toLocaleString()} USD`,
      ];

      // Add minimum trades per day rule if set
      if (tradingConstraints.minTradesPerDay !== null) {
        tradingRules.push(
          `Minimum trades per day requirement: ${tradingConstraints.minTradesPerDay} trades`,
        );
      }

      const rateLimits = [
        `${config.rateLimiting.maxRequests} requests per ${config.rateLimiting.windowMs / 1000} seconds per endpoint`,
        "100 requests per minute for trade operations",
        "300 requests per minute for price queries",
        "30 requests per minute for balance/portfolio checks",
        "3,000 requests per minute across all endpoints",
        "10,000 requests per hour per agent",
      ];

      const availableChains = {
        svm: true,
        evm: config.evmChains,
      };

      const slippageFormula =
        "baseSlippage = (tradeAmountUSD / 10000) * 0.05%, actualSlippage = baseSlippage * (0.9 + (Math.random() * 0.2))";

      // Assemble all rules (original format)
      const rules = {
        tradingRules,
        rateLimits,
        availableChains,
        slippageFormula,
        tradingConstraints,
      };

      const result = {
        success: true,
        competition,
        rules,
      };

      return result;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting competition rules with auth:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get competition trades with caching
   * @param params Parameters for trades request
   * @returns Competition trades with pagination
   */
  async getCompetitionTrades(params: {
    competitionId: string;
    pagingParams: PagingParams;
  }): Promise<CompetitionTradesData> {
    try {
      // Get competition
      const competition = await this.getCompetition(params.competitionId);
      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Get trades for the competition
      const { trades, total } =
        await this.tradeSimulatorService.getCompetitionTrades(
          params.competitionId,
          params.pagingParams.limit,
          params.pagingParams.offset,
        );

      const result = {
        success: true,
        trades,
        competition,
        pagination: buildPaginationResponse(
          total,
          params.pagingParams.limit,
          params.pagingParams.offset,
        ),
      };

      return result;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting competition trades with auth:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get agent trades in competition with caching
   * @param params Parameters for agent trades request
   * @returns Agent trades in competition with pagination
   */
  async getAgentTradesInCompetition(params: {
    competitionId: string;
    agentId: string;
    pagingParams: PagingParams;
  }): Promise<AgentCompetitionTradesData> {
    try {
      // Get competition
      const competition = await this.getCompetition(params.competitionId);
      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Check if agent exists
      const agent = await this.agentService.getAgent(params.agentId);
      if (!agent) {
        throw new ApiError(404, "Agent not found");
      }

      // Get trades
      const { trades, total } =
        await this.tradeSimulatorService.getAgentTradesInCompetition(
          params.competitionId,
          params.agentId,
          params.pagingParams.limit,
          params.pagingParams.offset,
        );

      const result = {
        success: true,
        trades,
        pagination: buildPaginationResponse(
          total,
          params.pagingParams.limit,
          params.pagingParams.offset,
        ),
      };

      return result;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting agent competition trades with auth:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get transfer violation summary for a perps competition
   * Returns only agents who have made transfers during the competition
   * @param competitionId Competition ID
   * @returns Array of agents with transfer counts
   */
  async getCompetitionTransferViolations(competitionId: string): Promise<
    Array<{
      agentId: string;
      agentName: string;
      transferCount: number;
    }>
  > {
    try {
      // 1. Verify competition exists and is perps type
      const competition = await this.getCompetition(competitionId);
      if (!competition) {
        throw new ApiError(404, `Competition ${competitionId} not found`);
      }

      if (competition.type !== "perpetual_futures") {
        throw new ApiError(
          400,
          `Competition ${competitionId} is not a perpetual futures competition`,
        );
      }

      if (!competition.startDate) {
        // No transfers can be violations if competition hasn't started
        return [];
      }

      // 2. Get transfer violation counts from repository (SQL aggregation)
      const violationCounts = await getCompetitionTransferViolationCounts(
        competitionId,
        competition.startDate,
      );

      // 3. Enrich with agent names (batch fetch)
      if (violationCounts.length === 0) {
        return [];
      }

      const agentIds = violationCounts.map((v) => v.agentId);
      const agents = await this.agentService.getAgentsByIds(agentIds);

      // Create a map for quick lookup
      const agentMap = new Map(agents.map((agent) => [agent.id, agent.name]));

      // 4. Combine data and return
      const results = violationCounts.map((violation) => ({
        agentId: violation.agentId,
        agentName: agentMap.get(violation.agentId) ?? "Unknown Agent",
        transferCount: violation.transferCount,
      }));

      serviceLogger.info(
        `[CompetitionService] Found ${results.length} agents with transfer violations in competition ${competitionId}`,
      );

      return results;
    } catch (error) {
      serviceLogger.error(
        `[CompetitionService] Error getting competition transfer violations:`,
        error,
      );
      throw error;
    }
  }
}
