import { v4 as uuidv4 } from "uuid";

import {
  findById as findAgentById,
  isAgentInCompetition,
} from "@/database/repositories/agent-repository.js";
import {
  addAgentToCompetition,
  batchInsertLeaderboard,
  create as createCompetition,
  findActive,
  findAll,
  findById,
  findByStatus,
  findLeaderboardByCompetition,
  getCompetitionAgents,
  getLatestPortfolioSnapshots,
  removeAgentFromCompetition,
  update as updateCompetition,
} from "@/database/repositories/competition-repository.js";
import {
  AgentManager,
  BalanceManager,
  ConfigurationService,
  PortfolioSnapshotter,
  TradeSimulator,
} from "@/services/index.js";
import {
  ACTOR_STATUS,
  COMPETITION_STATUS,
  COMPETITION_TYPE,
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionStatus,
  CompetitionStatusSchema,
  CompetitionType,
  CrossChainTradingType,
  PagingParams,
} from "@/types/index.js";

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

  constructor(
    balanceManager: BalanceManager,
    tradeSimulator: TradeSimulator,
    portfolioSnapshotter: PortfolioSnapshotter,
    agentManager: AgentManager,
    configurationService: ConfigurationService,
  ) {
    this.balanceManager = balanceManager;
    this.tradeSimulator = tradeSimulator;
    this.portfolioSnapshotter = portfolioSnapshotter;
    this.agentManager = agentManager;
    this.configurationService = configurationService;
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
   * @param externalUrl Optional URL for external competition details
   * @param imageUrl Optional URL to the competition image
   * @returns The created competition
   */
  async createCompetition(
    name: string,
    description?: string,
    tradingType: CrossChainTradingType = CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    externalUrl?: string,
    imageUrl?: string,
    type: CompetitionType = COMPETITION_TYPE.TRADING,
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
      status: COMPETITION_STATUS.PENDING,
      crossChainTradingType: tradingType,
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

      // Register agent in the competition
      await addAgentToCompetition(competitionId, agentId);

      // Use the agent manager service to reactivate agents - this properly clears the cache
      await this.agentManager.reactivateAgent(agentId);
      console.log(`[CompetitionManager] Activated agent: ${agentId}`);
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

    // Deactivate all agents in the competition
    console.log(
      `[CompetitionManager] Deactivating ${competitionAgents.length} agents for ended competition`,
    );
    for (const agentId of competitionAgents) {
      try {
        await this.agentManager.deactivateAgent(
          agentId,
          `Competition ${competition.name} (${competitionId}) ended`,
        );
      } catch (error) {
        console.error(
          `[CompetitionManager] Error deactivating agent ${agentId}:`,
          error,
        );
      }
    }

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
    const leaderboardEntries = leaderboard.map((entry, index) => ({
      agentId: entry.agentId,
      competitionId,
      rank: index + 1, // 1-based ranking
      score: entry.value, // Use the portfolio value as the score
    }));

    if (leaderboardEntries.length > 0) {
      await batchInsertLeaderboard(leaderboardEntries);
    }

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
   * Get the leaderboard for a competition
   * @param competitionId The competition ID
   * @returns Array of agent IDs sorted by portfolio value
   */
  async getLeaderboard(competitionId: string) {
    try {
      // First try to get from the competitions_leaderboard table
      const leaderboardEntries =
        await findLeaderboardByCompetition(competitionId);
      if (leaderboardEntries.length > 0) {
        return leaderboardEntries.map((entry) => ({
          agentId: entry.agentId,
          value: entry.score,
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
          }))
          .sort(
            (a: { value: number }, b: { value: number }) => b.value - a.value,
          );
      }

      // Fallback to calculating current values
      const agents = await getCompetitionAgents(competitionId);
      const leaderboard: { agentId: string; value: number }[] = [];

      for (const agentId of agents) {
        const portfolioValue =
          await this.tradeSimulator.calculatePortfolioValue(agentId);
        leaderboard.push({
          agentId,
          value: portfolioValue,
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

    // 6. Check if agent is already registered
    const isAlreadyInCompetition = await isAgentInCompetition(
      agentId,
      competitionId,
    );
    if (isAlreadyInCompetition) {
      throw new Error("Agent is already registered for this competition");
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

    // 4. Check if agent is registered for the competition
    const isInCompetition = await isAgentInCompetition(agentId, competitionId);
    if (!isInCompetition) {
      throw new Error("Agent is not registered for this competition");
    }

    // 5. Handle based on competition status
    if (competition.status === COMPETITION_STATUS.ENDED) {
      throw new Error("Cannot leave competition that has already ended");
    } else if (competition.status === COMPETITION_STATUS.ACTIVE) {
      // During active competition: deactivate the agent
      await this.agentManager.deactivateAgent(
        agentId,
        `Left competition ${competition.name} (${competitionId})`,
      );
      console.log(
        `[CompetitionManager] Deactivated agent ${agentId} for leaving active competition ${competitionId}`,
      );
    } else if (competition.status === COMPETITION_STATUS.PENDING) {
      // During pending competition: just remove from roster
      const wasRemoved = await removeAgentFromCompetition(
        competitionId,
        agentId,
      );
      if (!wasRemoved) {
        console.warn(
          `[CompetitionManager] Agent ${agentId} was not found in competition ${competitionId} roster`,
        );
      }
    }

    console.log(
      `[CompetitionManager] Successfully processed leave request for agent ${agentId} from competition ${competitionId}`,
    );
  }
}
