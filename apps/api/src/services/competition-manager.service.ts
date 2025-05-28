import { v4 as uuidv4 } from "uuid";

import {
  addAgentToCompetition,
  create as createCompetition,
  findActive,
  findAll,
  findById,
  findByStatus,
  getCompetitionAgents,
  getLatestPortfolioSnapshots,
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
  CompetitionStatus,
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
   * @param externalLink Optional URL for external competition details
   * @param imageUrl Optional URL to the competition image
   * @returns The created competition
   */
  async createCompetition(
    name: string,
    description?: string,
    tradingType: CrossChainTradingType = CrossChainTradingType.disallowAll,
    externalLink?: string,
    imageUrl?: string,
  ) {
    const id = uuidv4();
    const competition = {
      id,
      name,
      description,
      externalLink,
      imageUrl,
      startDate: null,
      endDate: null,
      status: CompetitionStatus.PENDING,
      crossChainTradingType: tradingType,
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

    if (competition.status !== CompetitionStatus.PENDING) {
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
    competition.status = CompetitionStatus.ACTIVE;
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

    if (competition.status !== CompetitionStatus.ACTIVE) {
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
    competition.status = CompetitionStatus.COMPLETED;
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

    return competition;
  }

  /**
   * Check if a competition is active
   * @param competitionId The competition ID
   * @returns True if the competition is active
   */
  async isCompetitionActive(competitionId: string) {
    const competition = await findById(competitionId);
    return competition?.status === CompetitionStatus.ACTIVE;
  }

  /**
   * Get the currently active competition
   * @returns The active competition or null if none
   */
  async getActiveCompetition() {
    // First check cache for better performance
    if (this.activeCompetitionCache) {
      const competition = await findById(this.activeCompetitionCache);
      if (competition?.status === CompetitionStatus.ACTIVE) {
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
      // Try to get from recent portfolio snapshots first
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
   * @returns Array of competitions with PENDING status
   */
  async getUpcomingCompetitions() {
    return findByStatus({
      status: CompetitionStatus.PENDING,
      params: {
        sort: "",
        limit: 100,
        offset: 0,
      },
    });
  }

  /**
   * Get all competitions with a given status and a sort, limit, or offset
   * @param status The status of the competitions to get
   * @param pagingParams The paging parameters to use
   * @returns Array of competitions.
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
}
