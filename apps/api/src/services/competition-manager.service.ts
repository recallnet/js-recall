import { v4 as uuidv4 } from "uuid";

import {
  SelectCompetitionReward,
  UpdateCompetition,
} from "@recallnet/db-schema/core/types";

import {
  findById as findAgentById,
  findByCompetition,
} from "@/database/repositories/agent-repository.js";
import { getAllAgentRanks } from "@/database/repositories/agentscore-repository.js";
import {
  addAgentToCompetition,
  batchInsertLeaderboard,
  create as createCompetition,
  findActive,
  findActiveCompetitionsPastEndDate,
  findAll,
  findById,
  findByStatus,
  findLeaderboardByTradingComp,
  get24hSnapshots,
  getAgentCompetitionRecord,
  getAllCompetitionAgents,
  getBulkAgentCompetitionRecords,
  getBulkAgentPortfolioSnapshots,
  getCompetitionAgents,
  getLatestPortfolioSnapshots,
  isAgentActiveInCompetition,
  updateAgentCompetitionStatus,
  update as updateCompetition,
  updateOne,
} from "@/database/repositories/competition-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import { applySortingAndPagination, splitSortField } from "@/lib/sort.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { CompetitionRewardService } from "@/services/competition-reward.service.js";
import {
  AgentManager,
  AgentRankService,
  BalanceManager,
  ConfigurationService,
  PortfolioSnapshotter,
  TradeSimulator,
  TradingConstraintsService,
  VoteManager,
} from "@/services/index.js";
import {
  COMPETITION_JOIN_ERROR_TYPES,
  CompetitionAgentStatus,
  CompetitionJoinError,
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
}

/**
 * Competition Manager Service
 * Manages trading competitions with agent-based participation
 */
export class CompetitionManager {
  private balanceManager: BalanceManager;
  private tradeSimulator: TradeSimulator;
  private portfolioSnapshotter: PortfolioSnapshotter;
  private agentManager: AgentManager;
  private configurationService: ConfigurationService;
  private agentRankService: AgentRankService;
  private voteManager: VoteManager;
  private tradingConstraintsService: TradingConstraintsService;
  private competitionRewardService: CompetitionRewardService;

  constructor(
    balanceManager: BalanceManager,
    tradeSimulator: TradeSimulator,
    portfolioSnapshotter: PortfolioSnapshotter,
    agentManager: AgentManager,
    configurationService: ConfigurationService,
    agentRankService: AgentRankService,
    voteManager: VoteManager,
    tradingConstraintsService: TradingConstraintsService,
    competitionRewardService: CompetitionRewardService,
  ) {
    this.balanceManager = balanceManager;
    this.tradeSimulator = tradeSimulator;
    this.portfolioSnapshotter = portfolioSnapshotter;
    this.agentManager = agentManager;
    this.configurationService = configurationService;
    this.agentRankService = agentRankService;
    this.voteManager = voteManager;
    this.tradingConstraintsService = tradingConstraintsService;
    this.competitionRewardService = competitionRewardService;
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

    await createCompetition(competition);

    let createdRewards: SelectCompetitionReward[] = [];
    if (rewards) {
      createdRewards = await this.competitionRewardService.createRewards(
        id,
        rewards,
      );
      serviceLogger.debug(
        `[CompetitionManager] Created rewards for competition ${id}: ${JSON.stringify(
          createdRewards,
        )}`,
      );
    }

    // Always create trading constraints (with defaults if not provided)
    const constraints = await this.tradingConstraintsService.createConstraints({
      competitionId: id,
      ...tradingConstraints,
    });
    serviceLogger.debug(
      `[CompetitionManager] Created trading constraints for competition ${id}`,
    );

    serviceLogger.debug(
      `[CompetitionManager] Created competition: ${name} (${id}), crossChainTradingType: ${tradingType}, type: ${type}}`,
    );
    return {
      ...competition,
      rewards: createdRewards.map((reward) => ({
        rank: reward.rank,
        reward: reward.reward,
      })),
      tradingConstraints: {
        minimumPairAgeHours: constraints?.minimumPairAgeHours,
        minimum24hVolumeUsd: constraints?.minimum24hVolumeUsd,
        minimumLiquidityUsd: constraints?.minimumLiquidityUsd,
        minimumFdvUsd: constraints?.minimumFdvUsd,
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
   * Start a competition
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
      // Reset balances
      await this.balanceManager.resetAgentBalances(agentId);

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
    // and the snapshotter has exclusive access to price API rate limits
    serviceLogger.debug(
      `[CompetitionManager] Taking initial portfolio snapshots for ${agentIds.length} agents (competition still pending)`,
    );
    await this.portfolioSnapshotter.takePortfolioSnapshots(competitionId);
    serviceLogger.debug(
      `[CompetitionManager] Initial portfolio snapshots completed`,
    );

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
   * @returns Number of leaderboard entries that were saved
   */
  private async calculateAndPersistFinalLeaderboard(
    competitionId: string,
    totalAgents: number,
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
        await this.agentManager.getAgentPerformanceForComp(
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
      await batchInsertLeaderboard(enrichedEntries);
    }

    return enrichedEntries.length;
  }

  /**
   * End a competition
   * @param competitionId The competition ID
   * @returns The updated competition
   */
  async endCompetition(competitionId: string) {
    const competition = await findById(competitionId);
    if (!competition) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    if (competition.status !== "active") {
      throw new Error(`Competition is not active: ${competition.status}`);
    }

    // Update the competition status FIRST to prevent new trades from being processed
    const finalCompetition = await updateCompetition({
      id: competitionId,
      status: "ended",
      endDate: new Date(),
      updatedAt: new Date(),
    });

    serviceLogger.debug(
      `[CompetitionManager] Ending competition: ${competition.name} (${competitionId}) - status updated to ENDED`,
    );

    // Take final portfolio snapshots (force=true to ensure we get final values even though status is ENDED)
    await this.portfolioSnapshotter.takePortfolioSnapshots(competitionId, true);

    // Get agents in the competition
    const competitionAgents = await getCompetitionAgents(competitionId);

    // Reload configuration settings (revert to environment defaults)
    await this.configurationService.loadCompetitionSettings();

    // Calculate final leaderboard, enrich with PnL data, and persist to database
    const leaderboardCount = await this.calculateAndPersistFinalLeaderboard(
      competitionId,
      competitionAgents.length,
    );

    // Update agent ranks based on competition results
    await this.agentRankService.updateAgentRanksForCompetition(competitionId);

    serviceLogger.debug(
      `[CompetitionManager] Competition ended successfully: ${competition.name} (${competitionId}) - ${competitionAgents.length} agents, ${leaderboardCount} leaderboard entries`,
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
      await this.voteManager.getVoteCountsByCompetition(competitionId);

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

    return snapshots
      .map((snapshot) => ({
        agentId: snapshot.agentId,
        value: snapshot.totalValue,
        pnl: 0, // PnL not available from snapshots alone
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
    const agents = await getCompetitionAgents(competitionId);

    // Use bulk portfolio value calculation
    const portfolioValues =
      await this.tradeSimulator.calculateBulkPortfolioValues(agents);

    const leaderboard = agents.map((agentId) => ({
      agentId,
      value: portfolioValues.get(agentId) || 0,
      pnl: 0, // PnL not available without historical data
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
      .map((agentId) => ({
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

        case "active": {
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
  async getLeaderboardWithInactiveAgents(competitionId: string): Promise<{
    activeAgents: Array<{ agentId: string; value: number }>;
    inactiveAgents: Array<{
      agentId: string;
      value: number;
      deactivationReason: string;
    }>;
  }> {
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
        const [competitionRecords, portfolioSnapshots] = await Promise.all([
          getBulkAgentCompetitionRecords(competitionId, inactiveAgentIds),
          getBulkAgentPortfolioSnapshots(competitionId, inactiveAgentIds),
        ]);

        // Create lookup maps for efficient data joining
        const competitionRecordsMap = new Map(
          competitionRecords.map((record) => [record.agentId, record]),
        );

        // Group snapshots by agent and get latest value for each
        const latestPortfolioValues =
          this.getLatestPortfolioValuesFromSnapshots(portfolioSnapshots);

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
   * Helper method to extract latest portfolio values from bulk snapshots
   * @param snapshots Array of portfolio snapshots from getBulkAgentPortfolioSnapshots
   * @returns Map of agentId to latest portfolio value
   */
  private getLatestPortfolioValuesFromSnapshots(
    snapshots: Awaited<ReturnType<typeof getBulkAgentPortfolioSnapshots>>,
  ): Map<string, number> {
    const latestValuesByAgent = new Map<string, number>();

    // Get latest value for each agent using a single-pass approach
    const latestSnapshotsByAgent = new Map<string, (typeof snapshots)[0]>();

    for (const snapshot of snapshots) {
      const currentLatestSnapshot = latestSnapshotsByAgent.get(
        snapshot.agentId,
      );
      if (
        !currentLatestSnapshot ||
        (snapshot.timestamp?.getTime() ?? 0) >
          (currentLatestSnapshot.timestamp?.getTime() ?? 0)
      ) {
        latestSnapshotsByAgent.set(snapshot.agentId, snapshot);
      }
    }

    // Extract total values from latest snapshots
    for (const [agentId, snapshot] of latestSnapshotsByAgent.entries()) {
      latestValuesByAgent.set(agentId, snapshot.totalValue ?? 0);
    }

    return latestValuesByAgent;
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
   * @param updates The fields to update
   * @returns The updated competition
   */
  async updateCompetition(competitionId: string, updates: UpdateCompetition) {
    // Get the existing competition
    const existingCompetition = await findById(competitionId);
    if (!existingCompetition) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    // Update the competition
    const updatedCompetition = await updateOne(competitionId, updates);

    serviceLogger.debug(
      `[CompetitionManager] Updated competition: ${competitionId}`,
    );

    return updatedCompetition;
  }

  /**
   * Join an agent to a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @param userId User ID (for ownership validation)
   */
  async joinCompetition(
    competitionId: string,
    agentId: string,
    userId: string,
  ): Promise<void> {
    serviceLogger.debug(
      `[CompetitionManager] Join competition request: agent ${agentId} to competition ${competitionId} by user ${userId}`,
    );

    // 1. Check if competition exists
    const competition = await findById(competitionId);
    if (!competition) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    // 2. Check if agent exists
    const agent = await findAgentById(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // 3. Check if agent belongs to user
    if (agent.ownerId !== userId) {
      throw new Error("Agent does not belong to requesting user");
    }

    // 4. Check join date constraints FIRST (must take precedence over other errors)
    const now = new Date();

    if (competition.joinStartDate && now < competition.joinStartDate) {
      const error = new Error(
        `Competition joining opens at ${competition.joinStartDate.toISOString()}`,
      ) as CompetitionJoinError;
      error.type = COMPETITION_JOIN_ERROR_TYPES.JOIN_NOT_YET_OPEN;
      error.code = 403;
      throw error;
    }

    if (competition.joinEndDate && now > competition.joinEndDate) {
      const error = new Error(
        `Competition joining closed at ${competition.joinEndDate.toISOString()}`,
      ) as CompetitionJoinError;
      error.type = COMPETITION_JOIN_ERROR_TYPES.JOIN_CLOSED;
      error.code = 403;
      throw error;
    }

    // 5. Check agent status is eligible
    if (agent.status === "deleted" || agent.status === "suspended") {
      throw new Error("Agent is not eligible to join competitions");
    }

    // 6. Check if competition status is pending
    if (competition.status !== "pending") {
      throw new Error("Cannot join competition that has already started/ended");
    }

    // 7. Check if agent is already actively registered
    const isAlreadyActive = await isAgentActiveInCompetition(
      competitionId,
      agentId,
    );
    if (isAlreadyActive) {
      throw new Error(
        "Agent is already actively registered for this competition",
      );
    }

    // 8. Atomically add agent to competition with participant limit check
    // This prevents race conditions when multiple agents try to join simultaneously
    try {
      await addAgentToCompetition(competitionId, agentId);
    } catch (error) {
      // Convert repository error to appropriate API error
      if (
        error instanceof Error &&
        error.message.includes("maximum participant limit")
      ) {
        const competitionError = new Error(
          error.message,
        ) as CompetitionJoinError;
        competitionError.type =
          COMPETITION_JOIN_ERROR_TYPES.PARTICIPANT_LIMIT_EXCEEDED;
        competitionError.code = 403;
        throw competitionError;
      }
      throw error;
    }

    serviceLogger.debug(
      `[CompetitionManager] Successfully joined agent ${agentId} to competition ${competitionId}`,
    );
  }

  /**
   * Remove an agent from a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @param userId User ID (for ownership validation)
   */
  async leaveCompetition(
    competitionId: string,
    agentId: string,
    userId: string,
  ): Promise<void> {
    serviceLogger.debug(
      `[CompetitionManager] Leave competition request: agent ${agentId} from competition ${competitionId} by user ${userId}`,
    );

    // 1. Check if competition exists
    const competition = await findById(competitionId);
    if (!competition) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    // 2. Check if agent exists
    const agent = await findAgentById(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // 3. Check if agent belongs to user
    if (agent.ownerId !== userId) {
      throw new Error("Agent does not belong to requesting user");
    }

    // 4. Check if agent is in the competition (any status)
    const isInCompetition = await this.isAgentInCompetition(
      competitionId,
      agentId,
    );
    if (!isInCompetition) {
      throw new Error("Agent is not in this competition");
    }

    // 5. Handle based on competition status
    if (competition.status === "ended") {
      throw new Error("Cannot leave competition that has already ended");
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
      `[CompetitionManager] Successfully processed leave request for agent ${agentId} from competition ${competitionId}`,
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
   * Automatically join an agent to the active competition if one exists
   * Used in sandbox mode to auto-join newly registered agents
   * @param agentId The agent ID to join to the active competition
   */
  async autoJoinAgentToActiveCompetition(agentId: string): Promise<void> {
    try {
      // Check if there's an active competition
      const activeCompetition = await this.getActiveCompetition();
      if (!activeCompetition) {
        serviceLogger.debug(
          `[CompetitionManager] No active competition found for auto-join of agent ${agentId}`,
        );
        return;
      }

      // Check if agent exists and is active
      const agent = await findAgentById(agentId);
      if (!agent) {
        serviceLogger.debug(
          `[CompetitionManager] Agent ${agentId} not found, skipping auto-join`,
        );
        return;
      }

      if (agent.status !== "active") {
        serviceLogger.debug(
          `[CompetitionManager] Agent ${agentId} is not active (status: ${agent.status}), skipping auto-join`,
        );
        return;
      }

      // Check if agent is already in the competition
      const isAlreadyInCompetition = await this.isAgentInCompetition(
        activeCompetition.id,
        agentId,
      );
      if (isAlreadyInCompetition) {
        serviceLogger.debug(
          `[CompetitionManager] Agent ${agentId} is already in competition ${activeCompetition.id}, skipping auto-join`,
        );
        return;
      }

      serviceLogger.debug(
        `[CompetitionManager] Auto-joining agent ${agentId} to active competition ${activeCompetition.id}`,
      );

      // Reset the agent's balances to starting values (consistent with startCompetition order)
      await this.balanceManager.resetAgentBalances(agentId);

      // Add the agent to the competition
      await addAgentToCompetition(activeCompetition.id, agentId);

      // Take a portfolio snapshot for the newly joined agent
      await this.portfolioSnapshotter.takePortfolioSnapshotForAgent(
        activeCompetition.id,
        agentId,
      );

      serviceLogger.debug(
        `[CompetitionManager] Successfully auto-joined agent ${agentId} to competition ${activeCompetition.id}`,
      );
    } catch (error) {
      // Log the error but don't throw - we don't want auto-join failures to break agent registration
      serviceLogger.error(
        `[CompetitionManager] Error auto-joining agent ${agentId} to active competition:`,
        error,
      );
    }
  }

  /**
   * Check and automatically end competitions that have reached their end date
   */
  async processCompetitionEndDateChecks(): Promise<void> {
    try {
      const competitionsToEnd = await findActiveCompetitionsPastEndDate();

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
            `[CompetitionManager] Auto-ending competition: ${competition.name} (${competition.id}) - scheduled end: ${competition.endDate!.toISOString()}`,
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
}
