import { randomUUID } from "crypto";
import { Logger } from "pino";

import { valueToAttoBigInt } from "@recallnet/conversions/atto-conversions";
import { AgentRepository } from "@recallnet/db/repositories/agent";
import { AgentScoreRepository } from "@recallnet/db/repositories/agent-score";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { PerpsRepository } from "@recallnet/db/repositories/perps";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { UserRepository } from "@recallnet/db/repositories/user";
import {
  SelectAgent,
  SelectCompetition,
  SelectCompetitionReward,
  UpdateCompetition,
} from "@recallnet/db/schema/core/types";
import {
  PerpetualPositionWithAgent,
  SelectPerpsCompetitionConfig,
  SelectTrade,
} from "@recallnet/db/schema/trading/types";
import type {
  Database,
  Transaction as DatabaseTransaction,
} from "@recallnet/db/types";

import { AgentService } from "./agent.service.js";
import { AgentRankService } from "./agentrank.service.js";
import { BalanceService } from "./balance.service.js";
import { CompetitionRewardService } from "./competition-reward.service.js";
import {
  PaginationResponse,
  buildPaginationResponse,
} from "./lib/pagination-utils.js";
import { applySortingAndPagination, splitSortField } from "./lib/sort.js";
import { PerpsDataProcessor } from "./perps-data-processor.service.js";
import { PortfolioSnapshotterService } from "./portfolio-snapshotter.service.js";
import { RewardsService } from "./rewards.service.js";
import { TradeSimulatorService } from "./trade-simulator.service.js";
import { TradingConstraintsService } from "./trading-constraints.service.js";
import {
  AllocationUnit,
  BaseEnrichedLeaderboardEntry,
  CompetitionAgentStatus,
  CompetitionStatus,
  CompetitionType,
  CrossChainTradingType,
  DisplayState,
  EngineType,
  EnrichedLeaderboardEntry,
  EvaluationMetric,
  PagingParams,
  PerpsEnrichedLeaderboardEntry,
  SpecificChain,
  SpecificChainBalances,
  isPerpsEnrichedEntry,
} from "./types/index.js";
import { ApiError } from "./types/index.js";
import {
  AgentComputedSortFields,
  AgentDbSortFields,
  AgentQueryParams,
} from "./types/sort/agent.js";

/**
 * Parameters for creating a new competition
 */
export interface CreateCompetitionParams {
  name: string;
  arenaId: string; // Required - admins must explicitly specify arena
  description?: string;
  tradingType?: CrossChainTradingType;
  sandboxMode?: boolean;
  externalUrl?: string;
  imageUrl?: string;
  type?: CompetitionType;
  startDate?: Date;
  endDate?: Date;
  boostStartDate?: Date;
  boostEndDate?: Date;
  joinStartDate?: Date;
  joinEndDate?: Date;
  maxParticipants?: number;
  tradingConstraints?: TradingConstraintsInput;
  rewards?: Record<number, number>;
  minimumStake?: number;
  evaluationMetric?: EvaluationMetric;
  perpsProvider?: {
    provider: "symphony" | "hyperliquid";
    initialCapital: number; // Required - Zod default ensures this is set
    selfFundingThreshold: number; // Required - Zod default ensures this is set
    minFundingThreshold?: number; // Optional - minimum portfolio balance
    apiUrl?: string;
  };
  prizePools?: {
    agent: number;
    users: number;
  };

  // Engine routing (arenaId already defined above as required)
  engineId?: EngineType;
  engineVersion?: string;

  // Participation rules
  vips?: string[];
  allowlist?: string[];
  blocklist?: string[];
  minRecallRank?: number;
  allowlistOnly?: boolean;

  // Reward allocation
  agentAllocation?: number;
  agentAllocationUnit?: AllocationUnit;
  boosterAllocation?: number;
  boosterAllocationUnit?: AllocationUnit;
  rewardRules?: string;
  rewardDetails?: string;

  // Display
  displayState?: DisplayState;
}

/**
 * Return type for started competition with trading constraints and agent IDs
 */
export type StartedCompetitionResult = SelectCompetition & {
  tradingConstraints: {
    minimumPairAgeHours?: number;
    minimum24hVolumeUsd?: number;
    minimumLiquidityUsd?: number;
    minimumFdvUsd?: number;
  };
  agentIds: string[];
};

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
  sortinoRatio?: number | null;
  simpleReturn?: number | null;
  maxDrawdown?: number | null;
  downsideDeviation?: number | null;
  hasRiskMetrics?: boolean; // Indicates if agent has risk metrics calculated
}

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
 * Competition details with enriched data
 */
type CompetitionDetailsData = {
  success: boolean;
  competition: SelectCompetition & {
    evaluationMetric?: EvaluationMetric; // For perps competitions
    stats: {
      totalAgents: number;
      // Paper trading stats
      totalTrades?: number;
      totalVolume?: number;
      uniqueTokens?: number;
      // Perps stats
      totalPositions?: number;
      averageEquity?: number;
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
    rewardsTge?: {
      agentPool: string;
      userPool: string;
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
    // Performance metrics
    pnl: number;
    pnlPercent: number;
    change24h: number;
    change24hPercent: number;
    // Perps competition risk metrics (null for spot trading competitions)
    calmarRatio: number | null;
    simpleReturn: number | null;
    maxDrawdown: number | null;
    hasRiskMetrics: boolean;
  }>;
  pagination: PaginationResponse;
};

/**
 * Competition timeline entry structure
 */
type CompetitionTimelineEntry = {
  agentId: string;
  agentName: string;
  timeline: Array<{
    timestamp: string;
    totalValue: number;
    // Risk metrics (only for perps competitions)
    calmarRatio?: number | null;
    sortinoRatio?: number | null;
    maxDrawdown?: number | null;
    downsideDeviation?: number | null;
    simpleReturn?: number | null;
    annualizedReturn?: number | null;
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
  };
};

/**
 * Competition trades data structure
 */
type CompetitionTradesData = {
  success: boolean;
  trades: TradeWithAgent[];
  competition: SelectCompetition;
  total: number;
};

/**
 * Agent competition trades data structure
 */
type AgentCompetitionTradesData = {
  success: boolean;
  trades: SelectTrade[]; // Agent trades use basic SelectTrade format
  total: number;
};

/**
 * Leaderboard with inactive agents data structure
 */
interface LeaderboardWithInactiveAgents {
  activeAgents: LeaderboardEntry[];
  inactiveAgents: Array<{
    agentId: string;
    value: number;
    deactivationReason: string;
  }>;
}

/**
 * Basic competition info for unauthenticated users
 */

export interface CompetitionServiceConfig {
  evmChains: SpecificChain[];
  specificChainBalances: SpecificChainBalances;
  maxTradePercentage: number;
  rateLimiting: {
    maxRequests: number;
    windowMs: number;
  };
}

// Sentinel value for perps competitions with risk metrics but no evaluation metric value
const SENTINEL_SCORE_NO_METRIC = -999999;

/**
 * Competition Service
 * Manages trading competitions with agent-based participation
 */
export class CompetitionService {
  private balanceService: BalanceService;
  private tradeSimulatorService: TradeSimulatorService;
  private portfolioSnapshotterService: PortfolioSnapshotterService;
  private agentService: AgentService;
  private agentRankService: AgentRankService;
  private tradingConstraintsService: TradingConstraintsService;
  private competitionRewardService: CompetitionRewardService;
  private rewardsService: RewardsService;
  private perpsDataProcessor: PerpsDataProcessor;
  private agentRepo: AgentRepository;
  private agentScoreRepo: AgentScoreRepository;
  private perpsRepo: PerpsRepository;
  private competitionRepo: CompetitionRepository;
  private stakesRepo: StakesRepository;
  private userRepo: UserRepository;
  private db: Database;
  private config: CompetitionServiceConfig;
  private logger: Logger;

  constructor(
    balanceService: BalanceService,
    tradeSimulatorService: TradeSimulatorService,
    portfolioSnapshotterService: PortfolioSnapshotterService,
    agentService: AgentService,
    agentRankService: AgentRankService,
    tradingConstraintsService: TradingConstraintsService,
    competitionRewardService: CompetitionRewardService,
    rewardsService: RewardsService,
    perpsDataProcessor: PerpsDataProcessor,
    agentRepo: AgentRepository,
    agentScoreRepo: AgentScoreRepository,
    perpsRepo: PerpsRepository,
    competitionRepo: CompetitionRepository,
    stakesRepo: StakesRepository,
    userRepo: UserRepository,
    db: Database,
    config: CompetitionServiceConfig,
    logger: Logger,
  ) {
    this.balanceService = balanceService;
    this.tradeSimulatorService = tradeSimulatorService;
    this.portfolioSnapshotterService = portfolioSnapshotterService;
    this.agentService = agentService;
    this.agentRankService = agentRankService;
    this.tradingConstraintsService = tradingConstraintsService;
    this.competitionRewardService = competitionRewardService;
    this.rewardsService = rewardsService;
    this.perpsDataProcessor = perpsDataProcessor;
    this.agentRepo = agentRepo;
    this.agentScoreRepo = agentScoreRepo;
    this.perpsRepo = perpsRepo;
    this.competitionRepo = competitionRepo;
    this.stakesRepo = stakesRepo;
    this.userRepo = userRepo;
    this.db = db;
    this.config = config;
    this.logger = logger;
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
   * @param boostStartDate Optional boost start date
   * @param boostEndDate Optional boost end date
   * @param joinStartDate Optional start date for joining the competition
   * @param joinEndDate Optional end date for joining the competition
   * @param maxParticipants Optional maximum number of participants allowed
   * @param tradingConstraints Optional trading constraints for the competition
   * @param rewards Optional rewards for the competition
   * @param minimumStake Optional minimum stake amount
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
    boostStartDate,
    boostEndDate,
    joinStartDate,
    joinEndDate,
    maxParticipants,
    tradingConstraints,
    rewards,
    minimumStake,
    evaluationMetric,
    perpsProvider,
    prizePools,
    arenaId,
    engineId,
    engineVersion,
    vips,
    allowlist,
    blocklist,
    minRecallRank,
    allowlistOnly,
    agentAllocation,
    agentAllocationUnit,
    boosterAllocation,
    boosterAllocationUnit,
    rewardRules,
    rewardDetails,
    displayState,
  }: CreateCompetitionParams) {
    const id = randomUUID();

    const competitionType = type ?? "trading";

    const competition: Parameters<typeof this.competitionRepo.create>[0] = {
      id,
      name,
      description,
      externalUrl,
      imageUrl,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      boostStartDate: boostStartDate ?? null,
      boostEndDate: boostEndDate ?? null,
      joinStartDate: joinStartDate ?? null,
      joinEndDate: joinEndDate ?? null,
      maxParticipants: maxParticipants ?? null,
      minimumStake: minimumStake ?? null,
      status: "pending",
      crossChainTradingType: tradingType ?? "disallowAll",
      sandboxMode: sandboxMode ?? false,
      type: competitionType,
      createdAt: new Date(),
      updatedAt: new Date(),

      // Arena and engine routing
      arenaId,
      engineId: engineId ?? null,
      engineVersion: engineVersion ?? null,

      // Participation rules
      vips: vips ?? null,
      allowlist: allowlist ?? null,
      blocklist: blocklist ?? null,
      minRecallRank: minRecallRank ?? null,
      allowlistOnly: allowlistOnly ?? false,

      // Reward allocation
      agentAllocation: agentAllocation ?? null,
      agentAllocationUnit: agentAllocationUnit ?? null,
      boosterAllocation: boosterAllocation ?? null,
      boosterAllocationUnit: boosterAllocationUnit ?? null,
      rewardRules: rewardRules ?? null,
      rewardDetails: rewardDetails ?? null,

      // Display
      displayState: displayState ?? null,
    };

    // Execute all operations in a single transaction
    const result = await this.db.transaction(async (tx) => {
      // Create the competition
      await this.competitionRepo.create(competition, tx);

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
          minFundingThreshold:
            perpsProvider.minFundingThreshold?.toString() || null,
          evaluationMetric: evaluationMetric ?? ("calmar_ratio" as const),
        };

        await this.perpsRepo.createPerpsCompetitionConfig(perpsConfig, tx);
        this.logger.debug(
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
        this.logger.debug(
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
      this.logger.debug(
        `[CompetitionManager] Created trading constraints for competition ${id}`,
      );

      // Create prize pools if provided
      if (prizePools) {
        const attoPrizePools = {
          agent: valueToAttoBigInt(prizePools.agent),
          users: valueToAttoBigInt(prizePools.users),
        };
        await this.competitionRepo.updatePrizePools(id, attoPrizePools, tx);
      }

      return {
        competition,
        createdRewards,
        constraints,
      };
    });

    this.logger.debug(
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
    return this.competitionRepo.findById(competitionId);
  }

  /**
   * Get all competitions
   * @returns Array of all competitions
   */
  async getAllCompetitions() {
    return this.competitionRepo.findAll();
  }

  /**
   * Validates agent IDs and returns valid and invalid lists
   * @param agentIds Array of agent IDs to validate
   * @returns List of valid agent IDs
   * @throws ApiError if any agent IDs are invalid or inactive
   */
  private async validateAgentIds(agentIds: string[]): Promise<string[]> {
    const validAgentIds: string[] = [];
    const invalidAgentIds: string[] = [];

    const agents = await this.agentService.getAgentsByIds(agentIds);
    for (const agent of agents) {
      if (!agentIds.includes(agent.id) || agent.status !== "active") {
        invalidAgentIds.push(agent.id);
      } else {
        validAgentIds.push(agent.id);
      }
    }

    // If there are invalid agent IDs, throw an error with the list
    if (invalidAgentIds.length > 0) {
      throw new ApiError(
        400,
        `Cannot start competition: the following agent IDs are invalid or inactive: ${invalidAgentIds.join(", ")}`,
      );
    }

    return validAgentIds;
  }

  /**
   * Validates that agents have wallet addresses for perpetual futures competitions
   * @param agents Array of agents to validate
   * @param competitionType The type of competition
   * @throws ApiError if any agents lack wallet addresses for a perps competition
   */
  private validateAgentsForPerpsCompetition(
    agents: SelectAgent[],
    competitionType: CompetitionType,
  ): void {
    // Early return for non-perps competitions for efficiency
    if (competitionType !== "perpetual_futures") {
      return;
    }

    const agentsWithoutWallets = agents.filter((a) => !a.walletAddress);

    if (agentsWithoutWallets.length > 0) {
      const agentDescriptions = agentsWithoutWallets
        .map((a) => `${a.name} (${a.id})`)
        .join(", ");

      throw new ApiError(
        400,
        `Cannot proceed with perpetual futures competition: The following agents have no wallet address: ${agentDescriptions}`,
      );
    }
  }

  /**
   * Gets pre-registered agent IDs for a competition
   * @param competitionId The competition ID
   * @returns Array of pre-registered agent IDs
   */
  private async getPreRegisteredAgentIds(
    competitionId: string,
  ): Promise<string[]> {
    const competitionAgents = await this.agentService.getAgentsForCompetition(
      competitionId,
      { sort: "", limit: 1000, offset: 0, includeInactive: false },
    );
    return competitionAgents.agents.map((agent) => agent.id);
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
    agentIds?: string[],
    tradingConstraints?: TradingConstraintsInput,
  ): Promise<StartedCompetitionResult> {
    const competition = await this.competitionRepo.findById(competitionId);
    if (!competition) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    if (competition.status !== "pending") {
      throw new Error(
        `Competition is already in ${competition.status} state and cannot be started`,
      );
    }

    const activeCompetition = await this.competitionRepo.findActive();
    if (activeCompetition) {
      throw new Error(
        `Another competition is already active: ${activeCompetition.id}`,
      );
    }

    // Validate provided agent IDs, in case the caller provided `agentIds`
    if (agentIds) {
      // Note: this throws if any are invalid or inactive
      await this.validateAgentIds(agentIds);
    }

    // Get pre-registered agents
    const preRegisteredAgentIds =
      await this.getPreRegisteredAgentIds(competitionId);

    // Combine agent lists (remove duplicates)
    let finalAgentIds = [
      ...new Set([...(agentIds ?? []), ...preRegisteredAgentIds]),
    ];

    // Check if we have any agents
    if (finalAgentIds.length === 0) {
      throw new ApiError(400, `Cannot start competition: no registered agents`);
    }

    // For perps competitions, validate all agents have wallet addresses
    if (competition.type === "perpetual_futures") {
      const agents = await this.agentService.getAgentsByIds(finalAgentIds);
      this.validateAgentsForPerpsCompetition(agents, competition.type);
    }

    // Process all agent additions and activations
    for (const agentId of finalAgentIds) {
      await this.balanceService.resetAgentBalances(agentId, competition.type);

      // Note: Agent validation already done above, so we know agent exists and is active

      // Register agent in the competition (automatically sets status to 'active')
      try {
        await this.competitionRepo.addAgentToCompetition(
          competitionId,
          agentId,
        );
      } catch (error) {
        // If participant limit error, provide a more helpful error message
        if (
          error instanceof Error &&
          error.message.includes("maximum participant limit")
        ) {
          throw new Error(
            `Cannot start competition: ${error.message}. Participant limit reached. Some agents may already be registered.`,
          );
        }
        // Handle one-agent-per-user error
        if (
          error instanceof Error &&
          error.message.includes("already has an agent registered")
        ) {
          throw new Error(
            `Cannot start competition: A user has multiple agents in the participant list. Each user can only have one agent per competition.`,
          );
        }
        throw error;
      }

      this.logger.debug(
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
      this.logger.debug(
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
      this.logger.debug(
        `[CompetitionService] Taking initial paper trading portfolio snapshots for ${finalAgentIds.length} agents (competition still pending)`,
      );
      await this.portfolioSnapshotterService.takePortfolioSnapshots(
        competitionId,
      );
      this.logger.debug(
        `[CompetitionService] Initial paper trading portfolio snapshots completed`,
      );
    } else if (competition.type === "perpetual_futures") {
      // Perps: Sync from Symphony to get initial $500 balance state
      this.logger.debug(
        `[CompetitionService] Syncing initial perps data from Symphony for ${finalAgentIds.length} agents (competition still pending)`,
      );

      // Pass skipMonitoring=true for initial sync during competition startup
      const SKIP_MONITORING = true; // Skip self-funding monitoring during initial sync
      const result = await this.perpsDataProcessor.processPerpsCompetition(
        competitionId,
        SKIP_MONITORING,
      );

      const successCount = result.syncResult.successful.length;
      const failedCount = result.syncResult.failed.length;
      const totalCount = successCount + failedCount;

      this.logger.debug(
        `[CompetitionService] Initial perps sync completed: ${successCount}/${totalCount} agents synced successfully`,
      );

      if (failedCount > 0) {
        // Log which agents failed but don't throw - some agents may not have Symphony accounts yet
        const failedAgentIds = result.syncResult.failed.map((f) => f.agentId);
        this.logger.warn(
          `[CompetitionService] Failed to sync ${failedCount} out of ${totalCount} agents during competition start: ${failedAgentIds.join(", ")}`,
        );
      }

      // Enforce minimum funding threshold after initial sync
      // This must happen BEFORE competition goes active
      const perpsConfig =
        await this.perpsRepo.getPerpsCompetitionConfig(competitionId);

      if (perpsConfig && perpsConfig.minFundingThreshold) {
        const { removedAgents } = await this.enforceMinFundingThreshold(
          competitionId,
          perpsConfig,
        );

        // Remove the disqualified agents from finalAgentIds
        if (removedAgents.length > 0) {
          finalAgentIds = finalAgentIds.filter(
            (id) => !removedAgents.includes(id),
          );
        }
      }
    } else {
      throw new Error(`Unknown competition type: ${competition.type}`);
    }

    // NOW update the competition status to active
    // This opens trading and price endpoint access to agents
    const finalCompetition = await this.competitionRepo.update({
      id: competitionId,
      status: "active",
      startDate: new Date(),
      updatedAt: new Date(),
    });

    this.logger.debug(
      `[CompetitionManager] Started competition: ${competition.name} (${competitionId})`,
    );
    this.logger.debug(
      `[CompetitionManager] Participating agents: ${finalAgentIds.join(", ")}`,
    );

    return {
      ...finalCompetition,
      tradingConstraints: {
        minimumPairAgeHours: newConstraints?.minimumPairAgeHours,
        minimum24hVolumeUsd: newConstraints?.minimum24hVolumeUsd,
        minimumLiquidityUsd: newConstraints?.minimumLiquidityUsd,
        minimumFdvUsd: newConstraints?.minimumFdvUsd,
      },
      agentIds: finalAgentIds,
    } as StartedCompetitionResult;
  }

  /**
   * Check and enforce minimum funding threshold for perps competition
   * Removes agents below the threshold from the competition
   * @private
   */
  private async enforceMinFundingThreshold(
    competitionId: string,
    perpsConfig: SelectPerpsCompetitionConfig,
  ): Promise<{ removedAgents: string[] }> {
    // Only proceed if minFundingThreshold is configured
    if (!perpsConfig.minFundingThreshold) {
      return { removedAgents: [] };
    }

    const threshold = Number(perpsConfig.minFundingThreshold);
    const removedAgents: string[] = [];

    this.logger.info(
      `[CompetitionService] Enforcing minimum funding threshold of $${threshold} for competition ${competitionId}`,
    );

    // Get the latest portfolio snapshots for all agents
    const latestSnapshots =
      await this.competitionRepo.getLatestPortfolioSnapshots(competitionId);

    // Check each agent's portfolio value
    for (const snapshot of latestSnapshots) {
      const portfolioValue = Number(snapshot.totalValue);

      if (portfolioValue < threshold) {
        this.logger.warn(
          `[CompetitionService] Agent ${snapshot.agentId} has portfolio value $${portfolioValue.toFixed(2)}, below threshold $${threshold}. Removing from competition.`,
        );

        // Remove agent using existing method
        await this.removeAgentFromCompetition(
          competitionId,
          snapshot.agentId,
          `Insufficient initial funding: $${portfolioValue.toFixed(2)} < $${threshold} minimum`,
        );

        removedAgents.push(snapshot.agentId);
      }
    }

    if (removedAgents.length > 0) {
      this.logger.info(
        `[CompetitionService] Removed ${removedAgents.length} agents from competition ${competitionId} due to insufficient funding`,
      );
    }

    return { removedAgents };
  }

  /**
   * Start or create and start a competition.
   * If competitionId is provided, starts the existing competition.
   * If competitionId is not provided, creates a new competition with the given params and starts it.
   * @param params Parameters including either competitionId or competition creation data
   * @returns The started competition with final agent IDs
   */
  async startOrCreateCompetition(params: {
    competitionId?: string;
    agentIds: string[];
    tradingConstraints?: TradingConstraintsInput;
    // Optional creation params (required when competitionId not provided)
    creationParams?: CreateCompetitionParams;
  }): Promise<StartedCompetitionResult> {
    let competitionId: string;

    if (params.competitionId) {
      competitionId = params.competitionId;
    } else {
      // Create new competition
      if (!params.creationParams?.name) {
        throw new ApiError(
          400,
          "Name is required when creating a new competition",
        );
      }

      const newCompetition = await this.createCompetition({
        ...params.creationParams,
        tradingConstraints: params.tradingConstraints,
      });

      competitionId = newCompetition.id;
    }

    // Start the competition
    return await this.startCompetition(
      competitionId,
      params.agentIds,
      params.tradingConstraints,
    );
  }

  /**
   * Calculates final leaderboard, enriches with PnL data, and persists to database
   * @param competitionId The competition ID
   * @param totalAgents Total number of agents in the competition
   * @param tx Database transaction
   * @returns The enriched leaderboard array that was processed
   */
  private async calculateAndPersistFinalLeaderboard(
    competitionId: string,
    totalAgents: number,
    tx: DatabaseTransaction,
  ): Promise<LeaderboardEntry[]> {
    // Get the competition to check its type
    const competition = await this.competitionRepo.findById(competitionId);

    // Get the leaderboard (calculated from final snapshots)
    const leaderboard = await this.getLeaderboard(competitionId);

    const enrichedEntries: EnrichedLeaderboardEntry[] = [];

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

      // Determine the score based on competition type and evaluation metric
      let score: number;
      if (competition?.type === "perpetual_futures" && entry.hasRiskMetrics) {
        // Fetch the evaluation metric from perps config
        const perpsConfig =
          await this.perpsRepo.getPerpsCompetitionConfig(competitionId);
        const evaluationMetric =
          perpsConfig?.evaluationMetric ?? "calmar_ratio";

        switch (evaluationMetric) {
          case "sortino_ratio":
            if (
              entry.sortinoRatio !== null &&
              entry.sortinoRatio !== undefined
            ) {
              score = entry.sortinoRatio;
            } else {
              score = SENTINEL_SCORE_NO_METRIC; // Sentinel for "has metrics but no ratio"
            }
            break;

          case "simple_return":
            if (
              entry.simpleReturn !== null &&
              entry.simpleReturn !== undefined
            ) {
              score = entry.simpleReturn;
            } else {
              score = SENTINEL_SCORE_NO_METRIC; // Sentinel for "has metrics but no return"
            }
            break;

          case "calmar_ratio":
          default:
            if (entry.calmarRatio !== null && entry.calmarRatio !== undefined) {
              score = entry.calmarRatio;
            } else {
              score = SENTINEL_SCORE_NO_METRIC; // Sentinel for "has metrics but no Calmar"
            }
            break;
        }
      } else {
        score = entry.value; // Portfolio value for spot trading or perps without metrics
      }

      // Add perps-specific fields if this is a perps competition with risk metrics
      if (competition?.type === "perpetual_futures" && entry.hasRiskMetrics) {
        const perpsEntry: PerpsEnrichedLeaderboardEntry = {
          agentId: entry.agentId,
          competitionId,
          rank: i + 1, // 1-based ranking
          pnl,
          startingValue,
          totalAgents,
          score,
          calmarRatio: entry.calmarRatio ?? null,
          sortinoRatio: entry.sortinoRatio ?? null,
          simpleReturn: entry.simpleReturn ?? null,
          maxDrawdown: entry.maxDrawdown ?? null,
          downsideDeviation: entry.downsideDeviation ?? null,
          totalEquity: entry.value, // Store portfolio value as totalEquity
          totalPnl: entry.pnl ?? null,
          hasRiskMetrics: true,
        };
        enrichedEntries.push(perpsEntry);
      } else {
        const baseEntry: BaseEnrichedLeaderboardEntry = {
          agentId: entry.agentId,
          competitionId,
          rank: i + 1, // 1-based ranking
          pnl,
          startingValue,
          totalAgents,
          score,
          hasRiskMetrics: false,
        };
        enrichedEntries.push(baseEntry);
      }
    }

    // Persist to database
    if (enrichedEntries.length > 0) {
      await this.competitionRepo.batchInsertLeaderboard(enrichedEntries, tx);
    }

    // Map enriched entries back to LeaderboardEntry format for return
    return enrichedEntries.map((entry) => {
      // Use the type guard to check if it's a perps entry with totalEquity
      const value = isPerpsEnrichedEntry(entry)
        ? entry.totalEquity
        : entry.score;

      return {
        agentId: entry.agentId,
        value,
        pnl: entry.pnl,
      };
    });
  }

  /**
   * End a competition
   * @param competitionId The competition ID
   * @returns The updated competition and final leaderboard
   */
  async endCompetition(competitionId: string): Promise<{
    competition: SelectCompetition;
    leaderboard: LeaderboardEntry[];
  }> {
    // Mark as ending (active -> ending) - this returns the competition object
    let competition =
      await this.competitionRepo.markCompetitionAsEnding(competitionId);

    if (!competition) {
      const current = await this.competitionRepo.findById(competitionId);
      if (!current) {
        throw new Error(`Competition not found: ${competitionId}`);
      }
      if (current.status === "ended") {
        // Competition already ended, get the leaderboard and return
        const leaderboard = await this.getLeaderboard(competitionId);
        return { competition: current, leaderboard };
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

    this.logger.debug(
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
      this.logger.debug(
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
      this.logger.debug(
        `[CompetitionService] Final perps sync completed: ${successCount}/${totalCount} agents synced successfully`,
      );
      if (failedCount > 0) {
        // Log warning but don't fail the competition ending
        this.logger.warn(
          `[CompetitionService] Failed to sync final data for ${failedCount} out of ${totalCount} agents in ending competition`,
        );
      }
    } else {
      this.logger.warn(
        `[CompetitionService] Unknown competition type ${competition.type} - skipping final snapshot`,
      );
    }

    // Get agents in the competition (outside transaction - they won't change)
    const competitionAgents =
      await this.competitionRepo.getCompetitionAgents(competitionId);

    // Final transaction to persist results
    const { competition: finalCompetition, leaderboard } =
      await this.db.transaction(async (tx) => {
        // Mark as ended. This is our guard against concurrent execution - if another process is
        // ending the same competition in parallel, only one will manage to mark it as ended, and
        // the other one's transaction will fail.
        const updated = await this.competitionRepo.markCompetitionAsEnded(
          competitionId,
          tx,
        );
        if (!updated) {
          throw new Error(
            "Competition was already ended or not in ending state",
          );
        }

        // Calculate final leaderboard, enrich with PnL data, and persist to database
        const leaderboard = await this.calculateAndPersistFinalLeaderboard(
          competitionId,
          competitionAgents.length,
          tx,
        );

        // Update agent ranks based on competition results
        await this.agentRankService.updateAgentRanksForCompetition(
          competitionId,
          tx,
        );

        // Assign winners to rewards
        await this.competitionRewardService.assignWinnersToRewards(
          competitionId,
          leaderboard,
          tx,
        );

        return { competition: updated, leaderboard };
      });

    // Log success only after transaction has committed
    this.logger.debug(
      `[CompetitionManager] Competition ended successfully: ${competition.name} (${competitionId}) - ` +
        `${competitionAgents.length} agents, ${leaderboard.length} leaderboard entries`,
    );

    return { competition: finalCompetition, leaderboard };
  }

  /**
   * Get all competitions that are open for boosting
   * @returns Competitions that are open for boosting
   */
  async getOpenForBoosting() {
    return this.competitionRepo.findOpenForBoosting();
  }

  /**
   * Check if a competition is active
   * @param competitionId The competition ID
   * @returns True if the competition is active
   */
  async isCompetitionActive(competitionId: string) {
    const competition = await this.competitionRepo.findById(competitionId);
    return competition?.status === "active";
  }

  /**
   * Get the currently active competition
   * @returns The active competition or null if none
   */
  async getActiveCompetition() {
    return this.competitionRepo.findActive();
  }

  /**
   * Check if the active competition is of a specific type (atomic operation)
   * @param type The competition type to check
   * @returns true if active competition matches the type, false otherwise
   */
  async isActiveCompetitionType(
    type: "trading" | "perpetual_futures",
  ): Promise<boolean> {
    const activeCompetition = await this.competitionRepo.findActive();
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
    const competition = await this.competitionRepo.findById(competitionId);
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
    const { agents, total } = await this.agentRepo.findByCompetition(
      competitionId,
      dbQueryParams,
      isComputedSort,
    );

    // Get leaderboard data for the competition to get scores and ranks
    const leaderboard = await this.getLeaderboard(competitionId);
    const agentStatusMap = new Map(
      agents.map((agent) => [agent.id, agent.competitionStatus]),
    );
    const leaderboardMap = new Map(
      leaderboard.map((entry, index) => {
        // If the agent's status in the competition is not active, score them as zero with a rank
        // equal to the total number of agents (last place). This ensures rank-based sorting always
        // works correctly.
        const competitionStatus = agentStatusMap.get(entry.agentId);
        if (competitionStatus !== "active") {
          return [entry.agentId, { score: 0, rank: total }];
        } else {
          return [entry.agentId, { score: entry.value, rank: index + 1 }];
        }
      }),
    );

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
      // Use competition-specific status instead of global agent status
      const isActive = agent.competitionStatus === "active";
      const competitionDeactivationReason = agent.competitionDeactivationReason;

      const leaderboardData = leaderboardMap.get(agent.id);
      const leaderboardEntry = leaderboard.find(
        (entry) => entry.agentId === agent.id,
      );
      const score = leaderboardData?.score ?? 0;
      const rank = leaderboardData?.rank ?? total; // Use last place if not in leaderboard
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
        deactivationReason: !isActive ? competitionDeactivationReason : null,
        rank,
        portfolioValue: score,
        pnl: metrics.pnl,
        pnlPercent: metrics.pnlPercent,
        change24h: metrics.change24h,
        change24hPercent: metrics.change24hPercent,
        // Risk metrics from leaderboard (perps competitions only)
        calmarRatio: leaderboardEntry?.calmarRatio ?? null,
        sortinoRatio: leaderboardEntry?.sortinoRatio ?? null,
        simpleReturn: leaderboardEntry?.simpleReturn ?? null,
        maxDrawdown: leaderboardEntry?.maxDrawdown ?? null,
        downsideDeviation: leaderboardEntry?.downsideDeviation ?? null,
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
    const snapshots =
      await this.competitionRepo.getLatestPortfolioSnapshots(competitionId);
    if (snapshots.length === 0) {
      return [];
    }

    // Check competition type to determine if we need risk metrics
    const competition = await this.competitionRepo.findById(competitionId);

    if (competition?.type === "perpetual_futures") {
      // For perps: Fetch risk-adjusted leaderboard which includes risk metrics
      // Get the evaluation metric from perps config for SQL-level sorting
      const perpsConfig =
        await this.perpsRepo.getPerpsCompetitionConfig(competitionId);
      const evaluationMetric = perpsConfig?.evaluationMetric ?? "calmar_ratio";
      const riskAdjustedLeaderboard =
        await this.perpsRepo.getRiskAdjustedLeaderboard(
          competitionId,
          500, // Reasonable limit
          0,
          evaluationMetric,
        );

      // Combine snapshot data with risk metrics
      const orderedResults: LeaderboardEntry[] = [];

      // Add all agents from riskAdjustedLeaderboard (already sorted by SQL)
      for (const entry of riskAdjustedLeaderboard) {
        const snapshot = snapshots.find((s) => s.agentId === entry.agentId);

        // Use snapshot value if available, otherwise use equity from risk-adjusted leaderboard
        const portfolioValue = snapshot
          ? snapshot.totalValue
          : Number(entry.totalEquity) || 0;

        orderedResults.push({
          agentId: entry.agentId,
          value: portfolioValue,
          pnl: Number(entry.totalPnl) || 0, // Use PnL from risk-adjusted leaderboard
          calmarRatio: entry.calmarRatio ? Number(entry.calmarRatio) : null,
          sortinoRatio: entry.sortinoRatio ? Number(entry.sortinoRatio) : null,
          simpleReturn: entry.simpleReturn ? Number(entry.simpleReturn) : null,
          maxDrawdown: entry.maxDrawdown ? Number(entry.maxDrawdown) : null,
          downsideDeviation: entry.downsideDeviation
            ? Number(entry.downsideDeviation)
            : null,
          hasRiskMetrics: entry.hasRiskMetrics,
        });
      }

      return orderedResults;
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
    const competition = await this.competitionRepo.findById(competitionId);

    if (competition?.type === "perpetual_futures") {
      // For perps: Use a single-query method that combines risk metrics and equity
      // This uses lateral joins to get everything in one DB query, already sorted correctly:
      // 1. Agents with Calmar ratio (sorted by Calmar DESC)
      // 2. Agents without Calmar ratio (sorted by equity DESC)

      // Get the evaluation metric from perps config for SQL-level sorting
      const perpsConfig =
        await this.perpsRepo.getPerpsCompetitionConfig(competitionId);
      const evaluationMetric = perpsConfig?.evaluationMetric ?? "calmar_ratio";
      const riskAdjustedLeaderboard =
        await this.perpsRepo.getRiskAdjustedLeaderboard(
          competitionId,
          500, // Reasonable limit - most competitions won't have more agents
          0,
          evaluationMetric,
        );

      // Transform to LeaderboardEntry format, including risk metrics
      // Already sorted by SQL, no need for additional sorting
      return riskAdjustedLeaderboard.map((entry) => ({
        agentId: entry.agentId,
        value: Number(entry.totalEquity) || 0, // Keep as portfolio value for API compatibility
        pnl: Number(entry.totalPnl) || 0,
        // Include risk-adjusted metrics
        calmarRatio: entry.calmarRatio ? Number(entry.calmarRatio) : null,
        sortinoRatio: entry.sortinoRatio ? Number(entry.sortinoRatio) : null,
        simpleReturn: entry.simpleReturn ? Number(entry.simpleReturn) : null,
        maxDrawdown: entry.maxDrawdown ? Number(entry.maxDrawdown) : null,
        downsideDeviation: entry.downsideDeviation
          ? Number(entry.downsideDeviation)
          : null,
        hasRiskMetrics: entry.hasRiskMetrics,
      }));
    }

    // For paper trading: Use existing balance-based calculation
    const agents =
      await this.competitionRepo.getCompetitionAgents(competitionId);

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
    type: CompetitionType,
  ): Promise<LeaderboardEntry[]> {
    const agentIds =
      await this.competitionRepo.getCompetitionAgents(competitionId);
    const globalLeaderboard = await this.agentScoreRepo.getAllAgentRanks({
      agentIds,
      type,
    });

    // Create map of agent IDs to their global rank scores
    const globalLeaderboardMap = new Map(
      globalLeaderboard.map((agent) => [agent.id, agent.score]),
    );

    return agentIds
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
      const competition = await this.competitionRepo.findById(competitionId);
      if (!competition) {
        this.logger.warn(
          `[CompetitionManager] Competition ${competitionId} not found`,
        );
        return [];
      }

      switch (competition.status) {
        case "pending":
          return await this.calculatePendingCompetitionLeaderboard(
            competitionId,
            competition.type,
          );

        case "ended": {
          // Try saved leaderboard first
          let savedLeaderboard: LeaderboardEntry[] = [];

          // Check competition type to use the appropriate retrieval method
          if (competition.type === "perpetual_futures") {
            savedLeaderboard =
              await this.competitionRepo.findLeaderboardByPerpsComp(
                competitionId,
              );
          } else {
            savedLeaderboard =
              await this.competitionRepo.findLeaderboardByTradingComp(
                competitionId,
              );
          }

          if (savedLeaderboard.length > 0) {
            return savedLeaderboard;
          }

          this.logger.debug(
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

          this.logger.debug(
            `[CompetitionManager] No snapshots found for competition ${competitionId}, calculating from live portfolio values`,
          );
          // Fallback to live calculation
          return await this.calculateLeaderboardFromLivePortfolios(
            competitionId,
          );
        }

        default:
          this.logger.warn(
            `[CompetitionManager] Unknown competition status: ${competition.status}`,
          );
          return [];
      }
    } catch (error) {
      this.logger.error(
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
        // Bulk operations to fetch all inactive agent data
        const [competitionRecords, latestSnapshots] = await Promise.all([
          this.competitionRepo.getBulkAgentCompetitionRecords(
            competitionId,
            inactiveAgentIds,
          ),
          this.competitionRepo.getBulkLatestPortfolioSnapshots(
            competitionId,
            inactiveAgentIds,
          ),
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

        this.logger.debug(
          `[CompetitionManager] Successfully retrieved ${inactiveAgents.length} inactive agents using bulk operations`,
        );
      }

      return {
        activeAgents: activeLeaderboard.map((entry) => ({
          agentId: entry.agentId,
          value: entry.value,
          pnl: entry.pnl,
          calmarRatio: entry.calmarRatio,
          simpleReturn: entry.simpleReturn,
          maxDrawdown: entry.maxDrawdown,
          hasRiskMetrics: entry.hasRiskMetrics,
        })),
        inactiveAgents,
      };
    } catch (error) {
      this.logger.error(
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

    this.logger.debug(
      `[CompetitionManager] Calculating bulk metrics for ${agentIds.length} agents in competition ${competitionId}`,
    );

    try {
      // Get only the snapshots we need for metrics calculation
      const { earliestSnapshots, snapshots24hAgo } =
        await this.competitionRepo.get24hSnapshots(competitionId, agentIds);

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

      this.logger.debug(
        `[CompetitionManager] Successfully calculated bulk metrics for ${agentIds.length} agents`,
      );
      return metricsMap;
    } catch (error) {
      this.logger.error(
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
      await this.competitionRepo.findAll();
      return true;
    } catch (error) {
      this.logger.error("[CompetitionManager] Health check failed:", error);
      return false;
    }
  }

  /**
   * Update a competition
   * @param competitionId The competition ID
   * @param updates The core competition fields to update
   * @param tradingConstraints Optional trading constraints to update
   * @param rewards Optional rewards to replace
   * @param minimumStake Optional minimum stake amount
   * @param perpsProvider Optional perps provider config (required when changing to perps type)
   * @returns The updated competition with constraints and rewards
   */
  async updateCompetition(
    competitionId: string,
    updates: UpdateCompetition,
    tradingConstraints?: TradingConstraintsInput,
    rewards?: Record<number, number>,
    evaluationMetric?: EvaluationMetric,
    perpsProvider?: {
      provider: "symphony" | "hyperliquid";
      initialCapital: number; // Required - Zod default ensures this is set
      selfFundingThreshold: number; // Required - Zod default ensures this is set
      minFundingThreshold?: number;
      apiUrl?: string;
    },
    prizePools?: {
      agent: number;
      users: number;
    },
  ): Promise<{
    competition: SelectCompetition;
    updatedRewards: SelectCompetitionReward[];
  }> {
    // Get the existing competition
    const existingCompetition =
      await this.competitionRepo.findById(competitionId);
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
    const result = await this.db.transaction(async (tx) => {
      // Handle type conversion if needed
      if (isTypeChanging && updates.type) {
        const oldType = existingCompetition.type;
        const newType = updates.type;

        this.logger.info(
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
          const deleted = await this.perpsRepo.deletePerpsCompetitionConfig(
            competitionId,
            tx,
          );
          if (deleted) {
            this.logger.warn(
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
            minFundingThreshold:
              perpsProvider.minFundingThreshold?.toString() || null,
            evaluationMetric: evaluationMetric ?? ("calmar_ratio" as const),
          };

          await this.perpsRepo.createPerpsCompetitionConfig(perpsConfig, tx);
          this.logger.debug(
            `[CompetitionService] Created perps config for converted competition ${competitionId}`,
          );
        } else if (oldType === "perpetual_futures" && newType === "trading") {
          // Perps → Spot: Delete perps config using repository method
          await this.perpsRepo.deletePerpsCompetitionConfig(competitionId, tx);
          this.logger.debug(
            `[CompetitionService] Deleted perps config for converted competition ${competitionId}`,
          );
        }
      } else if (
        existingCompetition.type === "perpetual_futures" &&
        (perpsProvider || evaluationMetric)
      ) {
        // Update perps config for existing perps competition
        this.logger.info(
          `[CompetitionService] Updating perps config for competition ${competitionId}`,
        );

        const configUpdates: {
          dataSourceConfig?: {
            type: "external_api";
            provider: "symphony" | "hyperliquid";
            apiUrl?: string;
          };
          initialCapital?: string;
          selfFundingThresholdUsd?: string;
          minFundingThreshold?: string | null;
          evaluationMetric?: EvaluationMetric;
        } = {};

        if (perpsProvider) {
          configUpdates.dataSourceConfig = {
            type: "external_api" as const,
            provider: perpsProvider.provider,
            apiUrl: perpsProvider.apiUrl,
          };
          configUpdates.initialCapital =
            perpsProvider.initialCapital.toString();
          configUpdates.selfFundingThresholdUsd =
            perpsProvider.selfFundingThreshold.toString();
          configUpdates.minFundingThreshold =
            perpsProvider.minFundingThreshold?.toString() || null;
        }

        if (evaluationMetric) {
          configUpdates.evaluationMetric = evaluationMetric;
        }

        const updatedConfig = await this.perpsRepo.updatePerpsCompetitionConfig(
          competitionId,
          configUpdates,
          tx,
        );

        if (!updatedConfig) {
          this.logger.warn(
            `[CompetitionService] No perps config found to update for competition ${competitionId}`,
          );
        } else {
          const updateDetails = [];
          if (perpsProvider) {
            updateDetails.push(
              `threshold=${perpsProvider.selfFundingThreshold}`,
              `capital=${perpsProvider.initialCapital}`,
            );
          }
          if (evaluationMetric) {
            updateDetails.push(`evaluationMetric=${evaluationMetric}`);
          }
          this.logger.debug(
            `[CompetitionService] Updated perps config for competition ${competitionId}: ` +
              updateDetails.join(", "),
          );
        }
      }

      // Update the competition
      const updatedCompetition = await this.competitionRepo.updateOne(
        competitionId,
        updates,
        tx,
      );

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

      // Upsert prize pools if provided
      if (prizePools) {
        const attoPrizePools = {
          agent: valueToAttoBigInt(prizePools.agent),
          users: valueToAttoBigInt(prizePools.users),
        };
        await this.competitionRepo.updatePrizePools(
          competitionId,
          attoPrizePools,
          tx,
        );
      }

      return { competition: updatedCompetition, updatedRewards };
    });

    this.logger.debug(
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
    this.logger.debug(
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
    const competition = await this.competitionRepo.findById(competitionId);
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

    // Validate wallet address for perps competitions
    if (competition.type === "perpetual_futures" && !agent.walletAddress) {
      throw new ApiError(
        400,
        "Agent must have a wallet address to participate in perpetual futures competitions",
      );
    }

    // Check if competition status is pending
    if (competition.status !== "pending") {
      throw new ApiError(
        403,
        "Cannot join competition that has already started/ended",
      );
    }

    // Check if agent is already actively registered
    const isAlreadyActive =
      await this.competitionRepo.isAgentActiveInCompetition(
        competitionId,
        agentId,
      );
    if (isAlreadyActive) {
      throw new ApiError(
        403,
        "Agent is already actively registered for this competition",
      );
    }

    if (competition.minimumStake && competition.minimumStake > 0) {
      const user = await this.userRepo.findById(validatedUserId);
      if (!user) {
        throw new ApiError(404, `User not found: ${validatedUserId}`);
      }
      const totalStaked: bigint = await this.stakesRepo.getTotalStakedByWallet(
        user.walletAddress,
      );
      if (totalStaked < valueToAttoBigInt(competition.minimumStake)) {
        throw new ApiError(
          403,
          `The minimum stake requirement (${competition.minimumStake.toLocaleString()}) to join this competition is not met`,
        );
      }
    }

    // Atomically add agent to competition with participant limit check
    // This prevents race conditions when multiple agents try to join simultaneously
    try {
      await this.competitionRepo.addAgentToCompetition(competitionId, agentId);
    } catch (error) {
      // Convert repository error to appropriate API error
      if (
        error instanceof Error &&
        error.message.includes("maximum participant limit")
      ) {
        throw new ApiError(409, error.message);
      }
      // Handle one-agent-per-user error
      if (
        error instanceof Error &&
        error.message.includes("already has an agent registered")
      ) {
        throw new ApiError(
          409,
          "You already have an agent registered in this competition. Each user can only register one agent per competition.",
        );
      }
      throw error;
    }

    this.logger.debug(
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
    this.logger.debug(
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
    const competition = await this.competitionRepo.findById(competitionId);
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
      await this.competitionRepo.updateAgentCompetitionStatus(
        competitionId,
        agentId,
        "withdrawn",
        `Withdrew from competition ${competition.name}`,
      );
      this.logger.debug(
        `[CompetitionManager] Marked agent ${agentId} as withdrawn from active competition ${competitionId}`,
      );
    } else if (competition.status === "pending") {
      // During pending competition: mark as withdrawn (preserving history)
      await this.competitionRepo.updateAgentCompetitionStatus(
        competitionId,
        agentId,
        "withdrawn",
        `Withdrew from competition ${competition.name} before it started`,
      );
      this.logger.debug(
        `[CompetitionManager] Marked agent ${agentId} as left from pending competition ${competitionId}`,
      );
    }

    this.logger.debug(
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
    const record = await this.competitionRepo.getAgentCompetitionRecord(
      competitionId,
      agentId,
    );
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
    const competition = await this.competitionRepo.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    // Update agent status in competition to 'disqualified'
    await this.competitionRepo.updateAgentCompetitionStatus(
      competitionId,
      agentId,
      "disqualified",
      reason || "Disqualified by admin",
    );

    this.logger.debug(
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
    const competition = await this.competitionRepo.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    // Update agent status in competition to 'active'
    await this.competitionRepo.updateAgentCompetitionStatus(
      competitionId,
      agentId,
      "active",
      "Reactivated by admin",
    );

    this.logger.debug(
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
    return await this.competitionRepo.isAgentActiveInCompetition(
      competitionId,
      agentId,
    );
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
    return await this.competitionRepo.getAgentCompetitionRecord(
      competitionId,
      agentId,
    );
  }

  /**
   * Get all agents that have ever participated in a competition, regardless of status
   * This is useful for retrieving portfolio snapshots for all agents including inactive ones
   * @param competitionId The competition ID
   * @returns Array of agent IDs
   */
  async getAllCompetitionAgents(competitionId: string): Promise<string[]> {
    return await this.competitionRepo.getAllCompetitionAgents(competitionId);
  }

  /**
   * Check and automatically end competitions that have reached their end date
   */
  async processCompetitionEndDateChecks(): Promise<void> {
    try {
      const competitionsToEnd =
        await this.competitionRepo.findCompetitionsNeedingEnding();

      if (competitionsToEnd.length === 0) {
        this.logger.debug("[CompetitionManager] No competitions ready to end");
        return;
      }

      this.logger.debug(
        `[CompetitionManager] Found ${competitionsToEnd.length} competitions ready to end`,
      );

      for (const competition of competitionsToEnd) {
        try {
          this.logger.debug(
            `[CompetitionManager] Auto-ending competition: ${competition.name} (${competition.id}) - scheduled end: ${competition.endDate!.toISOString()} - status: ${competition.status}`,
          );

          await this.endCompetition(competition.id);

          this.logger.debug(
            `[CompetitionManager] Successfully auto-ended competition: ${competition.name} (${competition.id})`,
          );
        } catch (error) {
          this.logger.error(
            `[CompetitionManager] Error auto-ending competition ${competition.id}: ${error instanceof Error ? error : String(error)}`,
          );
          // Continue processing other competitions even if one fails
        }
      }
    } catch (error) {
      this.logger.error(
        `[CompetitionManager] Error in processCompetitionEndDateChecks: ${error instanceof Error ? error : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Check and automatically calculate rewards for competitions that have ended
   */
  async processPendingRewardsCompetitions(): Promise<void> {
    try {
      const competitions =
        await this.competitionRepo.findCompetitionsNeedingRewardsCalculation();

      if (competitions.length === 0) {
        this.logger.debug(
          "[CompetitionManager] No competitions needing rewards calculation",
        );
        return;
      }

      for (const competition of competitions) {
        // Ensure competition end date has passed by at least an hour
        const now = new Date();
        const endDate = competition.endDate;
        if (!endDate || now.getTime() - endDate.getTime() < 60 * 60 * 1000) {
          this.logger.debug(
            `[CompetitionManager] Skipping rewards calculation for competition ${competition.name} (${competition.id}) because end date has not passed by an hour (endDate: ${endDate ? endDate.toISOString() : "N/A"}, now: ${now.toISOString()})`,
          );
          continue;
        }

        try {
          this.logger.debug(
            `[CompetitionManager] Calculating rewards for competition: ${competition.name} (${competition.id})`,
          );

          await this.rewardsService.calculateAndAllocate(competition.id);

          this.logger.debug(
            `[CompetitionManager] Successfully calculated rewards for competition: ${competition.name} (${competition.id})`,
          );
        } catch (error) {
          this.logger.error(
            `[CompetitionManager] Error calculating rewards for competition ${competition.id}: ${error instanceof Error ? error : String(error)}`,
          );
          // Continue processing other competitions even if one fails
        }
      }
    } catch (error) {
      this.logger.error(
        `[CompetitionManager] Error in processPendingRewardsCompetitions: ${error instanceof Error ? error : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Check and automatically start competitions that have reached their start date
   * Conditions:
   * - No other competition is currently active
   * - Competition is not in sandbox mode
   * - Competition has at least one registered agent
   * - Process competitions by earliest startDate first
   */
  async processCompetitionStartDateChecks(): Promise<void> {
    try {
      // Do not start anything if there's already an active competition
      const active = await this.competitionRepo.findActive();
      if (active) {
        this.logger.debug(
          {
            competitionId: active.id,
            name: active.name,
          },
          `[CompetitionManager] Active competition found. Skipping auto-start checks`,
        );
        return;
      }

      const competitionsToStart =
        await this.competitionRepo.findCompetitionsNeedingStarting();
      if (competitionsToStart.length === 0) {
        this.logger.debug(
          "[CompetitionManager] No competitions ready to start",
        );
        return;
      }

      // We only support running one competition at a time, so we will not start any competitions
      // if we find more than one. Note: This should not happen if competitions are created with
      // the correct start dates; it's defensive.
      const competition = competitionsToStart[0];
      if (competitionsToStart.length > 1 || !competition) {
        this.logger.warn(
          {
            competitions: competitionsToStart.map((c) => ({
              id: c.id,
              name: c.name,
              startDate: c.startDate?.toISOString(),
            })),
          },
          `[CompetitionManager] Multiple competitions ready to start. Skipping auto-start checks`,
        );
        return;
      }
      this.logger.debug(
        {
          competitionId: competition.id,
          name: competition.name,
          startDate: competition.startDate?.toISOString(),
        },
        `[CompetitionManager] Auto-starting competition`,
      );
      await this.startCompetition(competition.id);
      this.logger.debug(
        {
          competitionId: competition.id,
          name: competition.name,
        },
        `[CompetitionManager] Successfully auto-started competition`,
      );
    } catch (error) {
      // Continue silently if the competition has no registered nor provided agents
      if (
        error instanceof ApiError &&
        error.statusCode === 400 &&
        error.message.includes("no registered agents")
      ) {
        this.logger.error(
          `[CompetitionManager] No registered agents found for competition. Skipping auto-start.`,
        );
        return;
      }
    }
  }

  /**
   * Builds initial balance descriptions from configuration
   * @returns Array of formatted balance descriptions by chain
   */
  private buildInitialBalanceDescriptions(): string[] {
    const initialBalanceDescriptions = [];

    // Chain-specific balances
    for (const chain of Object.keys(this.config.specificChainBalances)) {
      const chainBalances =
        this.config.specificChainBalances[
          chain as keyof typeof this.config.specificChainBalances
        ];
      const tokenItems = [];

      for (const token of Object.keys(chainBalances || {})) {
        const amount = chainBalances?.[token];
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

    return initialBalanceDescriptions;
  }

  /**
   * Builds core trading rules array for a competition
   * @param competition The competition to build rules for
   * @param tradingConstraints Trading constraints for the competition
   * @param initialBalanceDescriptions Formatted balance descriptions
   * @returns Array of trading rule strings
   */
  private buildTradingRules(
    competition: SelectCompetition & { crossChainTradingType: string },
    tradingConstraints: {
      minimumPairAgeHours: number;
      minimum24hVolumeUsd: number;
      minimumLiquidityUsd: number;
      minimumFdvUsd: number;
      minTradesPerDay: number | null;
    },
    initialBalanceDescriptions: string[],
  ): string[] {
    const tradingRules = [
      "Trading is only allowed for tokens with valid price data",
      `All agents start with identical token balances: ${initialBalanceDescriptions.join("; ")}`,
      "Minimum trade amount: 0.000001 tokens",
      `Maximum single trade: ${this.config.maxTradePercentage}% of agent's total portfolio value`,
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

    return tradingRules;
  }

  /**
   * Builds rate limits array
   * @returns Array of rate limit strings
   */
  private buildRateLimits(): string[] {
    return [
      `${this.config.rateLimiting.maxRequests} requests per ${this.config.rateLimiting.windowMs / 1000} seconds per endpoint`,
      "100 requests per minute for trade operations",
      "300 requests per minute for price queries",
      "30 requests per minute for balance/portfolio checks",
      "3,000 requests per minute across all endpoints",
      "10,000 requests per hour per agent",
    ];
  }

  /**
   * Assembles complete competition rules data
   * @param competition The competition to assemble rules for
   * @param tradingConstraints Trading constraints for the competition
   * @returns Complete competition rules data
   */
  private async assembleCompetitionRules(
    competition: SelectCompetition & { crossChainTradingType: string },
  ): Promise<CompetitionRulesData> {
    const tradingConstraints =
      await this.tradingConstraintsService.getConstraintsWithDefaults(
        competition.id,
      );
    const initialBalanceDescriptions = this.buildInitialBalanceDescriptions();
    const tradingRules = this.buildTradingRules(
      competition,
      tradingConstraints,
      initialBalanceDescriptions,
    );
    const rateLimits = this.buildRateLimits();

    const availableChains = {
      svm: true,
      evm: this.config.evmChains,
    };

    const slippageFormula =
      "baseSlippage = (tradeAmountUSD / 10000) * 0.05%, actualSlippage = baseSlippage * (0.9 + (Math.random() * 0.2))";

    const rules = {
      tradingRules,
      rateLimits,
      availableChains,
      slippageFormula,
      tradingConstraints,
    };

    return {
      success: true,
      competition,
      rules,
    };
  }

  /**
   * Get rules for a specific competition by competition ID.
   * @param competitionId The competition ID
   * @returns Competition rules
   */
  async getCompetitionRules(
    competitionId: string,
  ): Promise<CompetitionRulesData> {
    try {
      // Get specific competition
      const competition = await this.getCompetition(competitionId);
      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Use helper method to assemble complete rules
      return await this.assembleCompetitionRules(competition);
    } catch (error) {
      this.logger.error(
        `[CompetitionService] Error getting competition rules:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get enriched competitions with trading constraint data
   * @param params Parameters for competitions request
   * @returns Enriched competitions list
   */
  async getEnrichedCompetitions(params: {
    status?: CompetitionStatus;
    pagingParams: PagingParams;
  }) {
    try {
      const { competitions, total } = await this.competitionRepo.findByStatus({
        status: params.status,
        params: params.pagingParams,
      });

      // Batch fetch perps configs for perps competitions
      const perpsCompetitionIds = competitions
        .filter((c) => c.type === "perpetual_futures")
        .map((c) => c.id);

      const perpsConfigsMap = new Map<string, EvaluationMetric>();
      if (perpsCompetitionIds.length > 0) {
        const perpsConfigs = await Promise.all(
          perpsCompetitionIds.map(async (id) => {
            const config = await this.perpsRepo.getPerpsCompetitionConfig(id);
            return { id, evaluationMetric: config?.evaluationMetric };
          }),
        );

        perpsConfigs.forEach(({ id, evaluationMetric }) => {
          if (evaluationMetric) {
            perpsConfigsMap.set(id, evaluationMetric);
          }
        });
      }

      const enrichedCompetitions = competitions.map((competition) => {
        const {
          minimumPairAgeHours,
          minimum24hVolumeUsd,
          minimumLiquidityUsd,
          minimumFdvUsd,
          minTradesPerDay,
          ...competitionData
        } = competition;

        const evaluationMetric = perpsConfigsMap.get(competition.id);

        return {
          ...competitionData,
          ...(evaluationMetric ? { evaluationMetric } : {}),
          tradingConstraints: {
            minimumPairAgeHours,
            minimum24hVolumeUsd,
            minimumLiquidityUsd,
            minimumFdvUsd,
            minTradesPerDay,
          },
        };
      });

      return {
        success: true,
        competitions: enrichedCompetitions,
        pagination: buildPaginationResponse(
          total,
          params.pagingParams.limit,
          params.pagingParams.offset,
        ),
      };
    } catch (error) {
      this.logger.error(
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
  }): Promise<CompetitionDetailsData> {
    try {
      // Fetch all data pieces first
      const [
        competition,
        tradeMetrics,
        rewards,
        tradingConstraints,
        prizePools,
      ] = await Promise.all([
        // Get competition details
        this.getCompetition(params.competitionId),
        // Get trade metrics for this competition
        this.tradeSimulatorService.getCompetitionTradeMetrics(
          params.competitionId,
        ),
        // Get reward structure
        this.competitionRewardService.getRewardsByCompetition(
          params.competitionId,
        ),
        // Get trading constraints
        this.tradingConstraintsService.getConstraintsWithDefaults(
          params.competitionId,
        ),
        this.competitionRepo.getCompetitionPrizePools(params.competitionId),
      ]);

      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Fetch evaluation metric for perps competitions
      let evaluationMetric: EvaluationMetric | undefined;
      if (competition.type === "perpetual_futures") {
        const perpsConfig = await this.perpsRepo.getPerpsCompetitionConfig(
          params.competitionId,
        );
        evaluationMetric = perpsConfig?.evaluationMetric;
      }

      // Build stats based on competition type
      let stats: {
        totalAgents: number;
        totalTrades?: number;
        totalVolume?: number;
        uniqueTokens?: number;
        totalPositions?: number;
        averageEquity?: number;
      };

      if (competition.type === "perpetual_futures") {
        // For perps competitions, get perps-specific stats
        const perpsStatsData = await this.perpsRepo.getPerpsCompetitionStats(
          params.competitionId,
        );
        stats = {
          totalAgents: competition.registeredParticipants,
          totalPositions: perpsStatsData?.totalPositions ?? 0,
          totalVolume: perpsStatsData?.totalVolume ?? 0,
          averageEquity: perpsStatsData?.averageEquity ?? 0,
          totalTrades: 0, // Not applicable for perps, but include for consistency
        };
      } else {
        // For paper trading competitions, include trade metrics
        stats = {
          totalTrades: tradeMetrics.totalTrades,
          totalAgents: competition.registeredParticipants,
          totalVolume: tradeMetrics.totalVolume,
          uniqueTokens: tradeMetrics.uniqueTokens,
          totalPositions: 0, // Not applicable for paper trading, but include for consistency
        };
      }

      // Format rewards
      const formattedRewards = rewards.map((r) => ({
        rank: r.rank,
        reward: r.reward,
        agentId: r.agentId,
      }));

      // Format prize pools
      const formattedPrizePools = prizePools
        ? {
            agentPool: prizePools.agentPool.toString(),
            userPool: prizePools.userPool.toString(),
          }
        : undefined;

      // Assemble final response
      const result = {
        success: true,
        competition: {
          ...competition,
          ...(evaluationMetric ? { evaluationMetric } : {}),
          stats,
          tradingConstraints,
          rewards: formattedRewards,
          rewardsTge: formattedPrizePools,
        },
      };

      return result;
    } catch (error) {
      this.logger.error(
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
    queryParams: AgentQueryParams;
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
      this.logger.error(
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
   * @returns Array of timeline entries for each agent
   */
  async getCompetitionTimeline(
    competitionId: string,
    bucket: number,
  ): Promise<CompetitionTimelineEntry[]> {
    try {
      // Get competition
      const competition = await this.getCompetition(competitionId);
      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Check if this is a perps competition to include risk metrics
      const includeRiskMetrics = competition.type === "perpetual_futures";

      // Get timeline data from portfolio snapshotter
      const rawData =
        await this.portfolioSnapshotterService.getAgentPortfolioTimeline(
          competitionId,
          bucket,
          includeRiskMetrics,
        );

      // Transform into the required structure
      const agentsMap = new Map<string, CompetitionTimelineEntry>();

      for (const item of rawData) {
        if (!agentsMap.has(item.agentId)) {
          agentsMap.set(item.agentId, {
            agentId: item.agentId,
            agentName: item.agentName,
            timeline: [],
          });
        }

        // Build timeline entry with optional risk metrics
        const timelineEntry: CompetitionTimelineEntry["timeline"][0] = {
          timestamp: item.timestamp,
          totalValue: item.totalValue,
        };

        // Add risk metrics if this is a perps competition and they exist in the data
        if (includeRiskMetrics) {
          // Use type assertion to access risk metrics properties that might exist
          const itemWithMetrics = item as typeof item & {
            calmarRatio?: number | null;
            sortinoRatio?: number | null;
            maxDrawdown?: number | null;
            downsideDeviation?: number | null;
            simpleReturn?: number | null;
            annualizedReturn?: number | null;
          };

          timelineEntry.calmarRatio = itemWithMetrics.calmarRatio ?? null;
          timelineEntry.sortinoRatio = itemWithMetrics.sortinoRatio ?? null;
          timelineEntry.maxDrawdown = itemWithMetrics.maxDrawdown ?? null;
          timelineEntry.downsideDeviation =
            itemWithMetrics.downsideDeviation ?? null;
          timelineEntry.simpleReturn = itemWithMetrics.simpleReturn ?? null;
          timelineEntry.annualizedReturn =
            itemWithMetrics.annualizedReturn ?? null;
        }

        agentsMap.get(item.agentId)!.timeline.push(timelineEntry);
      }

      return Array.from(agentsMap.values());
    } catch (error) {
      this.logger.error(
        `[CompetitionService] Error getting competition timeline with auth:`,
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
        total,
      };

      return result;
    } catch (error) {
      this.logger.error(
        `[CompetitionService] Error getting competition trades with auth:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all perps positions for a competition with pagination.
   * Similar to getCompetitionTrades but for perps positions.
   * @param params Parameters including competitionId, pagination, and optional status filter
   * @returns Positions array and total count
   */
  async getCompetitionPerpsPositions(params: {
    competitionId: string;
    pagingParams: PagingParams;
    statusFilter?: string;
  }): Promise<{
    positions: PerpetualPositionWithAgent[];
    total: number;
  }> {
    try {
      // Validate competition exists
      const competition = await this.getCompetition(params.competitionId);
      if (!competition) {
        throw new ApiError(404, "Competition not found");
      }

      // Validate competition type
      if (competition.type !== "perpetual_futures") {
        throw new ApiError(
          400,
          "This endpoint is only available for perpetual futures competitions. " +
            "Use GET /api/competitions/{id}/trades for paper trading competitions.",
        );
      }

      // Get positions from repository
      const { positions, total } =
        await this.perpsRepo.getCompetitionPerpsPositions(
          params.competitionId,
          params.pagingParams.limit,
          params.pagingParams.offset,
          params.statusFilter,
        );

      return { positions, total };
    } catch (error) {
      this.logger.error(
        `[CompetitionService] Error getting competition perps positions:`,
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
        total,
      };

      return result;
    } catch (error) {
      this.logger.error(
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

      // 2. Get transfer violation counts with agent names from repository
      const results =
        await this.perpsRepo.getCompetitionTransferViolationCounts(
          competitionId,
          competition.startDate,
        );

      // Results already include agentName
      if (results.length === 0) {
        return [];
      }

      this.logger.info(
        `[CompetitionService] Found ${results.length} agents with transfer violations in competition ${competitionId}`,
      );

      return results;
    } catch (error) {
      this.logger.error(
        `[CompetitionService] Error getting competition transfer violations:`,
        error,
      );
      throw error;
    }
  }
}
