import { v4 as uuidv4 } from "uuid";

import {
  findById as findAgentById,
  findByCompetition,
} from "@/database/repositories/agent-repository.js";
import {
  addAgentToCompetition,
  batchInsertLeaderboard,
  create as createCompetition,
  findActive,
  findAll,
  findById,
  findByStatus,
  findLeaderboardByTradingComp,
  getAgentCompetitionRecord,
  getAllCompetitionAgents,
  getBulkAgentPortfolioSnapshots,
  getCompetitionAgents,
  getLatestPortfolioSnapshots,
  isAgentActiveInCompetition,
  updateAgentCompetitionStatus,
  update as updateCompetition,
  updateOne,
} from "@/database/repositories/competition-repository.js";
import { UpdateCompetition } from "@/database/schema/core/types.js";
import { applySortingAndPagination, splitSortField } from "@/lib/sort.js";
import {
  AgentManager,
  AgentRankService,
  BalanceManager,
  ConfigurationService,
  PortfolioSnapshotter,
  TradeSimulator,
  VoteManager,
} from "@/services/index.js";
import {
  ACTOR_STATUS,
  COMPETITION_AGENT_STATUS,
  COMPETITION_STATUS,
  COMPETITION_TYPE,
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionAgentStatus,
  CompetitionStatus,
  CompetitionStatusSchema,
  CompetitionType,
  CrossChainTradingType,
  PagingParams,
} from "@/types/index.js";
import {
  AgentComputedSortFields,
  AgentDbSortFields,
  AgentQueryParams,
} from "@/types/sort/agent.js";

/**
 * Competition Manager Service
 * Manages trading competitions with agent-based participation
 */
export class CompetitionManager {
  private balanceManager: BalanceManager;
  private tradeSimulator: TradeSimulator;
  private portfolioSnapshotter: PortfolioSnapshotter;
  private activeCompetitionCache: string | null = null;
  private agentManager: AgentManager;
  private configurationService: ConfigurationService;
  private agentRankService: AgentRankService;
  private voteManager: VoteManager;

  constructor(
    balanceManager: BalanceManager,
    tradeSimulator: TradeSimulator,
    portfolioSnapshotter: PortfolioSnapshotter,
    agentManager: AgentManager,
    configurationService: ConfigurationService,
    agentRankService: AgentRankService,
    voteManager: VoteManager,
  ) {
    this.balanceManager = balanceManager;
    this.tradeSimulator = tradeSimulator;
    this.portfolioSnapshotter = portfolioSnapshotter;
    this.agentManager = agentManager;
    this.configurationService = configurationService;
    this.agentRankService = agentRankService;
    this.voteManager = voteManager;
    // Load active competition on initialization
    this.loadActiveCompetition();
  }

  /**
   * Load the active competition from the database
   * This is used at startup to restore the active competition state
   */
  private async loadActiveCompetition() {
    try {
      const activeCompetition = await findActive();
      if (activeCompetition) {
        this.activeCompetitionCache = activeCompetition.id;
      }
    } catch (error) {
      console.error(
        "[CompetitionManager] Error loading active competition:",
        error,
      );
    }
  }

  /**
   * Create a new competition
   * @param name Competition name
   * @param description Optional description
   * @param tradingType Type of cross-chain trading to allow (defaults to disallowAll)
   * @param sandboxMode Whether to enable sandbox mode for auto-joining agents (defaults to false)
   * @param externalUrl Optional URL for external competition details
   * @param imageUrl Optional URL to the competition image
   * @returns The created competition
   */
  async createCompetition(
    name: string,
    description?: string,
    tradingType: CrossChainTradingType = CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    sandboxMode: boolean = false,
    externalUrl?: string,
    imageUrl?: string,
    type: CompetitionType = COMPETITION_TYPE.TRADING,
    votingStartDate?: Date,
    votingEndDate?: Date,
  ) {
    const id = uuidv4();
    const competition = {
      id,
      name,
      description,
      externalUrl,
      imageUrl,
      startDate: null,
      endDate: null,
      votingStartDate: votingStartDate || null,
      votingEndDate: votingEndDate || null,
      status: COMPETITION_STATUS.PENDING,
      crossChainTradingType: tradingType,
      sandboxMode,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await createCompetition(competition);

    console.log(
      `[CompetitionManager] Created competition: ${name} (${id}), crossChainTradingType: ${tradingType}`,
    );
    return competition;
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
   * @returns The updated competition
   */
  async startCompetition(competitionId: string, agentIds: string[]) {
    const competition = await findById(competitionId);
    if (!competition) {
      throw new Error(`Competition not found: ${competitionId}`);
    }

    if (competition.status !== COMPETITION_STATUS.PENDING) {
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

      // Register agent in the competition (automatically sets status to 'active')
      await addAgentToCompetition(competitionId, agentId);

      // Ensure agent is globally active (but don't force reactivation)
      const agent = await findAgentById(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      if (agent.status !== ACTOR_STATUS.ACTIVE) {
        throw new Error(
          `Cannot start competition with agent ${agentId}: agent status is ${agent.status}`,
        );
      }

      console.log(
        `[CompetitionManager] Agent ${agentId} ready for competition`,
      );
    }

    // Update competition status
    competition.status = COMPETITION_STATUS.ACTIVE;
    competition.startDate = new Date();
    competition.updatedAt = new Date();
    await updateCompetition(competition);

    // Update cache
    this.activeCompetitionCache = competitionId;

    console.log(
      `[CompetitionManager] Started competition: ${competition.name} (${competitionId})`,
    );
    console.log(
      `[CompetitionManager] Participating agents: ${agentIds.join(", ")}`,
    );

    // Take initial portfolio snapshots
    await this.portfolioSnapshotter.takePortfolioSnapshots(competitionId);

    // Reload competition-specific configuration settings
    await this.configurationService.loadCompetitionSettings();
    console.log(`[CompetitionManager] Reloaded configuration settings`);

    return competition;
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

    if (competition.status !== COMPETITION_STATUS.ACTIVE) {
      throw new Error(`Competition is not active: ${competition.status}`);
    }

    if (this.activeCompetitionCache !== competitionId) {
      throw new Error(
        `Competition is not the active one: ${this.activeCompetitionCache}`,
      );
    }

    // Take final portfolio snapshots
    await this.portfolioSnapshotter.takePortfolioSnapshots(competitionId);

    // Get agents in the competition
    const competitionAgents = await getCompetitionAgents(competitionId);

    console.log(
      `[CompetitionManager] Competition ended. ${competitionAgents.length} agents remain 'active' in completed competition`,
    );

    // Update competition status
    competition.status = CompetitionStatusSchema.parse("ended");
    competition.endDate = new Date();
    competition.updatedAt = new Date();

    await updateCompetition(competition);

    // Update cache
    this.activeCompetitionCache = null;

    console.log(
      `[CompetitionManager] Ended competition: ${competition.name} (${competitionId})`,
    );

    // Reload configuration settings (revert to environment defaults)
    await this.configurationService.loadCompetitionSettings();
    console.log(`[CompetitionManager] Reloaded configuration settings`);

    const leaderboard = await this.getLeaderboard(competitionId);

    const leaderboardEntries = [];
    // Note: the leaderboard array could be quite large, avoiding Promise.all
    //  so that these async calls to get pnl happen in series and don't over
    //  use system resorces.
    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      if (entry === undefined) continue;
      const agentId = entry.agentId;
      const pnl = await this.agentManager.getAgentPnlForComp(
        agentId,
        competitionId,
      );

      const val = {
        agentId,
        competitionId,
        rank: i + 1, // 1-based ranking
        pnl: pnl.pnl,
        totalAgents: competitionAgents.length,
        score: entry.value, // Use the the total portfolio value in usd is saved as `score`
      };

      leaderboardEntries.push(val);
    }

    if (leaderboardEntries.length > 0) {
      await batchInsertLeaderboard(leaderboardEntries);
    }

    // Update agent ranks based on competition results
    await this.agentRankService.updateAgentRanksForCompetition(competitionId);

    return competition;
  }

  /**
   * Check if a competition is active
   * @param competitionId The competition ID
   * @returns True if the competition is active
   */
  async isCompetitionActive(competitionId: string) {
    const competition = await findById(competitionId);
    return competition?.status === COMPETITION_STATUS.ACTIVE;
  }

  /**
   * Get the currently active competition
   * @returns The active competition or null if none
   */
  async getActiveCompetition() {
    // First check cache for better performance
    if (this.activeCompetitionCache) {
      const competition = await findById(this.activeCompetitionCache);
      if (competition?.status === COMPETITION_STATUS.ACTIVE) {
        return competition;
      } else {
        // Cache is out of sync, clear it
        this.activeCompetitionCache = null;
      }
    }

    // Fallback to database query
    const activeCompetition = await findActive();
    if (activeCompetition) {
      this.activeCompetitionCache = activeCompetition.id;
    }
    return activeCompetition;
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

    // Get leaderboard data for the competition to get scores and positions
    const leaderboard = await this.getLeaderboard(competitionId);
    const leaderboardMap = new Map(
      leaderboard.map((entry, index) => [
        entry.agentId,
        { score: entry.value, position: index + 1 },
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
      const position = leaderboardData?.position ?? 0;
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
        description: agent.description,
        imageUrl: agent.imageUrl,
        score: score,
        active: isActive,
        deactivationReason: !isActive ? agent.deactivationReason : null,
        position: position,
        portfolioValue: score,
        pnl: metrics.pnl,
        pnlPercent: metrics.pnlPercent,
        change24h: metrics.change24h,
        change24hPercent: metrics.change24hPercent,
        voteCount: voteCount,
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
   * Get the leaderboard for a competition
   * @param competitionId The competition ID
   * @returns Array of agent IDs sorted by portfolio value
   */
  async getLeaderboard(competitionId: string) {
    try {
      // First try to get from the competitions_leaderboard table
      const leaderboardEntries =
        await findLeaderboardByTradingComp(competitionId);
      if (leaderboardEntries.length > 0) {
        return leaderboardEntries.map((entry) => ({
          agentId: entry.agentId,
          value: entry.score,
          pnl: entry.pnl,
        }));
      }

      console.log(
        `[CompetitionManager] No leaderboard found in database for competition ${competitionId}, calculating from snapshots or current values`,
      );

      // If no leaderboard entries, try to get from recent portfolio snapshots
      const snapshots = await getLatestPortfolioSnapshots(competitionId);

      if (snapshots.length > 0) {
        // Sort by value descending
        return snapshots
          .map((snapshot) => ({
            agentId: snapshot.agentId,
            value: snapshot.totalValue,
            pnl: 0, // TODO: if there's no competitions_leaderboard row we don't have a pnl
          }))
          .sort(
            (a: { value: number }, b: { value: number }) => b.value - a.value,
          );
      }

      // Fallback to calculating current values
      const agents = await getCompetitionAgents(competitionId);
      const leaderboard: { agentId: string; value: number; pnl: number }[] = [];

      for (const agentId of agents) {
        const portfolioValue =
          await this.tradeSimulator.calculatePortfolioValue(agentId);
        leaderboard.push({
          agentId,
          value: portfolioValue,
          pnl: 0, // TODO: if there's no competitions_leaderboard row we don't have a pnl
        });
      }

      // Sort by value descending
      return leaderboard.sort((a, b) => b.value - a.value);
    } catch (error) {
      console.error(
        `[CompetitionManager] Error getting leaderboard for competition ${competitionId}:`,
        error,
      );
      return [];
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

    console.log(
      `[CompetitionManager] Calculating bulk metrics for ${agentIds.length} agents in competition ${competitionId}`,
    );

    try {
      // Get all portfolio snapshots for all agents in one query using repository
      const allSnapshots = await getBulkAgentPortfolioSnapshots(
        competitionId,
        agentIds,
      );

      // Group snapshots by agent ID with proper typing
      const snapshotsByAgent = new Map<string, typeof allSnapshots>();
      for (const snapshot of allSnapshots) {
        const agentSnapshots = snapshotsByAgent.get(snapshot.agentId) || [];
        agentSnapshots.push(snapshot);
        snapshotsByAgent.set(snapshot.agentId, agentSnapshots);
      }

      // Calculate metrics for each agent
      const metricsMap = new Map();
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      for (const agentId of agentIds) {
        const currentValue = currentValues.get(agentId) || 0;
        const snapshots = snapshotsByAgent.get(agentId) || [];

        // Default values
        let pnl = 0;
        let pnlPercent = 0;
        let change24h = 0;
        let change24hPercent = 0;

        if (snapshots.length > 0) {
          // Sort snapshots by timestamp (oldest first) with proper typing
          const sortedSnapshots = snapshots.sort(
            (a: (typeof snapshots)[0], b: (typeof snapshots)[0]) =>
              (a.timestamp?.getTime() ?? 0) - (b.timestamp?.getTime() ?? 0),
          );

          // Get starting value (earliest snapshot)
          const startingSnapshot = sortedSnapshots[0];
          const startingValue = startingSnapshot?.totalValue ?? 0;

          // Calculate PnL
          if (startingValue > 0) {
            pnl = currentValue - startingValue;
            pnlPercent = (pnl / startingValue) * 100;
          }

          // Find the snapshot closest to 24h ago
          let closestSnapshot = null;
          let smallestTimeDiff = Infinity;

          for (const snapshot of snapshots) {
            if (snapshot.timestamp) {
              const timeDiff = Math.abs(
                snapshot.timestamp.getTime() - twentyFourHoursAgo.getTime(),
              );
              if (timeDiff < smallestTimeDiff) {
                smallestTimeDiff = timeDiff;
                closestSnapshot = snapshot;
              }
            }
          }

          // Calculate 24h change
          if (closestSnapshot) {
            const value24hAgo = closestSnapshot.totalValue;
            if (value24hAgo > 0) {
              change24h = currentValue - value24hAgo;
              change24hPercent = (change24h / value24hAgo) * 100;
            }
          }
        }

        metricsMap.set(agentId, {
          pnl,
          pnlPercent,
          change24h,
          change24hPercent,
        });
      }

      console.log(
        `[CompetitionManager] Successfully calculated bulk metrics for ${agentIds.length} agents`,
      );
      return metricsMap;
    } catch (error) {
      console.error(
        `[CompetitionManager] Error in calculateBulkAgentMetrics:`,
        error,
      );

      // Fallback to individual calculations
      console.warn(
        `[CompetitionManager] Falling back to individual metric calculations`,
      );
      const metricsMap = new Map();
      for (const agentId of agentIds) {
        const currentValue = currentValues.get(agentId) || 0;
        const metrics = await this.calculateAgentMetrics(
          competitionId,
          agentId,
          currentValue,
        );
        metricsMap.set(agentId, metrics);
      }
      return metricsMap;
    }
  }

  /**
   * Calculate PnL and 24h change metrics for an agent in a competition
   * @param competitionId The competition ID
   * @param agentId The agent ID
   * @param currentValue The agent's current portfolio value
   * @returns Object containing pnl, pnlPercent, change24h, change24hPercent
   */
  async calculateAgentMetrics(
    competitionId: string,
    agentId: string,
    currentValue: number,
  ) {
    try {
      // Get portfolio snapshots for this agent in this competition
      const snapshots =
        await this.portfolioSnapshotter.getAgentPortfolioSnapshots(
          competitionId,
          agentId,
        );

      // Default values
      let pnl = 0;
      let pnlPercent = 0;
      let change24h = 0;
      let change24hPercent = 0;

      if (snapshots.length > 0) {
        // Sort snapshots by timestamp (oldest first)
        const sortedSnapshots = snapshots.sort(
          (a, b) =>
            (a.timestamp?.getTime() ?? 0) - (b.timestamp?.getTime() ?? 0),
        );

        // Get starting value (earliest snapshot)
        const startingSnapshot = sortedSnapshots[0];
        const startingValue = startingSnapshot?.totalValue ?? 0;

        // Calculate PnL
        if (startingValue > 0) {
          pnl = currentValue - startingValue;
          pnlPercent = (pnl / startingValue) * 100;
        }

        // Calculate 24h change
        const now = new Date();
        const twentyFourHoursAgo = new Date(
          now.getTime() - 24 * 60 * 60 * 1000,
        );

        // Find the snapshot closest to 24h ago
        let closestSnapshot = null;
        let smallestTimeDiff = Infinity;

        for (const snapshot of snapshots) {
          if (snapshot.timestamp) {
            const timeDiff = Math.abs(
              snapshot.timestamp.getTime() - twentyFourHoursAgo.getTime(),
            );
            if (timeDiff < smallestTimeDiff) {
              smallestTimeDiff = timeDiff;
              closestSnapshot = snapshot;
            }
          }
        }

        // Calculate 24h change
        if (closestSnapshot) {
          const value24hAgo = closestSnapshot.totalValue;
          if (value24hAgo > 0) {
            change24h = currentValue - value24hAgo;
            change24hPercent = (change24h / value24hAgo) * 100;
          }
        }
      }

      return { pnl, pnlPercent, change24h, change24hPercent };
    } catch (error) {
      console.error(
        `[CompetitionManager] Error calculating metrics for agent ${agentId}:`,
        error,
      );
      // Return default values on error
      return { pnl: 0, pnlPercent: 0, change24h: 0, change24hPercent: 0 };
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
      console.error("[CompetitionManager] Health check failed:", error);
      return false;
    }
  }

  /**
   * Get all upcoming (pending) competitions
   * @returns Object with competitions array and total count
   */
  async getUpcomingCompetitions() {
    return findByStatus({
      status: COMPETITION_STATUS.PENDING,
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

    console.log(`[CompetitionManager] Updated competition: ${competitionId}`);

    // Clear cache if this was the active competition
    if (this.activeCompetitionCache === competitionId) {
      this.activeCompetitionCache = null;
    }

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
    console.log(
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

    // 4. Check agent status is eligible
    if (
      agent.status === ACTOR_STATUS.DELETED ||
      agent.status === ACTOR_STATUS.SUSPENDED
    ) {
      throw new Error("Agent is not eligible to join competitions");
    }

    // 5. Check if competition status is pending
    if (competition.status !== COMPETITION_STATUS.PENDING) {
      throw new Error("Cannot join competition that has already started/ended");
    }

    // 6. Check if agent is already actively registered
    const isAlreadyActive = await isAgentActiveInCompetition(
      competitionId,
      agentId,
    );
    if (isAlreadyActive) {
      throw new Error(
        "Agent is already actively registered for this competition",
      );
    }

    // Add agent to competition
    await addAgentToCompetition(competitionId, agentId);

    console.log(
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
    console.log(
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
    if (competition.status === COMPETITION_STATUS.ENDED) {
      throw new Error("Cannot leave competition that has already ended");
    } else if (competition.status === COMPETITION_STATUS.ACTIVE) {
      // During active competition: mark agent as withdrawn from this competition
      await updateAgentCompetitionStatus(
        competitionId,
        agentId,
        COMPETITION_AGENT_STATUS.WITHDRAWN,
        `Withdrew from competition ${competition.name}`,
      );
      console.log(
        `[CompetitionManager] Marked agent ${agentId} as withdrawn from active competition ${competitionId}`,
      );
    } else if (competition.status === COMPETITION_STATUS.PENDING) {
      // During pending competition: mark as withdrawn (preserving history)
      await updateAgentCompetitionStatus(
        competitionId,
        agentId,
        COMPETITION_AGENT_STATUS.WITHDRAWN,
        `Withdrew from competition ${competition.name} before it started`,
      );
      console.log(
        `[CompetitionManager] Marked agent ${agentId} as left from pending competition ${competitionId}`,
      );
    }

    console.log(
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
      COMPETITION_AGENT_STATUS.DISQUALIFIED,
      reason || "Disqualified by admin",
    );

    console.log(
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
      COMPETITION_AGENT_STATUS.ACTIVE,
      "Reactivated by admin",
    );

    console.log(
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
        console.log(
          `[CompetitionManager] No active competition found for auto-join of agent ${agentId}`,
        );
        return;
      }

      // Check if agent exists and is active
      const agent = await findAgentById(agentId);
      if (!agent) {
        console.log(
          `[CompetitionManager] Agent ${agentId} not found, skipping auto-join`,
        );
        return;
      }

      if (agent.status !== ACTOR_STATUS.ACTIVE) {
        console.log(
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
        console.log(
          `[CompetitionManager] Agent ${agentId} is already in competition ${activeCompetition.id}, skipping auto-join`,
        );
        return;
      }

      console.log(
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

      console.log(
        `[CompetitionManager] Successfully auto-joined agent ${agentId} to competition ${activeCompetition.id}`,
      );
    } catch (error) {
      // Log the error but don't throw - we don't want auto-join failures to break agent registration
      console.error(
        `[CompetitionManager] Error auto-joining agent ${agentId} to active competition:`,
        error,
      );
    }
  }
}
