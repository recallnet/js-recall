import { v4 as uuidv4 } from "uuid";

import { CrossChainTradingType } from "@recallnet/comps-db/schema";

import {
  addTeamToCompetition,
  create as createCompetition,
  findActive,
  findAll,
  findById,
  findByStatus,
  getCompetitionTeams,
  getLatestPortfolioSnapshots,
  update as updateCompetition,
} from "@/database/repositories/competition-repository.js";
import {
  BalanceManager,
  ConfigurationService,
  PortfolioSnapshotter,
  TeamManager,
  TradeSimulator,
} from "@/services/index.js";
import { CompetitionStatus } from "@/types/index.js";

/**
 * Competition Manager Service
 * Manages trading competitions
 */
export class CompetitionManager {
  private balanceManager: BalanceManager;
  private tradeSimulator: TradeSimulator;
  private portfolioSnapshotter: PortfolioSnapshotter;
  private activeCompetitionCache: string | null = null;
  private teamManager: TeamManager;
  private configurationService: ConfigurationService;

  constructor(
    balanceManager: BalanceManager,
    tradeSimulator: TradeSimulator,
    portfolioSnapshotter: PortfolioSnapshotter,
    teamManager: TeamManager,
    configurationService: ConfigurationService,
  ) {
    this.balanceManager = balanceManager;
    this.tradeSimulator = tradeSimulator;
    this.portfolioSnapshotter = portfolioSnapshotter;
    this.teamManager = teamManager;
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
   * @param crossChainTradingType Type of cross-chain trading to allow (defaults to DISALLOWALL)
   * @returns The created competition
   */
  async createCompetition(
    name: string,
    description?: string,
    crossChainTradingType: CrossChainTradingType = CrossChainTradingType.DISALLOWALL,
  ) {
    const id = uuidv4();
    const competition = {
      id,
      name,
      description,
      startDate: null,
      endDate: null,
      status: CompetitionStatus.PENDING,
      crossChainTradingType,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await createCompetition(competition);

    console.log(
      `[CompetitionManager] Created competition: ${name} (${id}), crossChainTradingType: ${crossChainTradingType}`,
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
   * @param teamIds Array of team IDs participating in the competition
   * @returns The updated competition
   */
  async startCompetition(competitionId: string, teamIds: string[]) {
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

    // Process all team additions and activations
    for (const teamId of teamIds) {
      // Reset balances
      await this.balanceManager.resetTeamBalances(teamId);

      // Register team in the competition
      await addTeamToCompetition(competitionId, teamId);

      // Use the team manager service to reactivate teams - this properly clears the cache
      await this.teamManager.reactivateTeam(teamId);
      console.log(`[CompetitionManager] Activated team: ${teamId}`);
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
      `[CompetitionManager] Participating teams: ${teamIds.join(", ")}`,
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

    // Get teams in the competition
    const competitionTeams = await getCompetitionTeams(competitionId);

    // Deactivate all teams in the competition
    console.log(
      `[CompetitionManager] Deactivating ${competitionTeams.length} teams for ended competition`,
    );
    for (const teamId of competitionTeams) {
      try {
        await this.teamManager.deactivateTeam(
          teamId,
          `Competition ${competition.name} (${competitionId}) ended`,
        );
      } catch (error) {
        console.error(
          `[CompetitionManager] Error deactivating team ${teamId}:`,
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
   * @returns Array of team IDs sorted by portfolio value
   */
  async getLeaderboard(competitionId: string) {
    try {
      // Try to get from recent portfolio snapshots first
      const snapshots = await getLatestPortfolioSnapshots(competitionId);

      if (snapshots.length > 0) {
        // Sort by value descending
        return snapshots
          .map((snapshot) => ({
            teamId: snapshot.teamId,
            value: snapshot.totalValue,
          }))
          .sort(
            (a: { value: number }, b: { value: number }) => b.value - a.value,
          );
      }

      // Fallback to calculating current values
      const teams = await getCompetitionTeams(competitionId);
      const leaderboard: { teamId: string; value: number }[] = [];

      for (const teamId of teams) {
        const portfolioValue =
          await this.tradeSimulator.calculatePortfolioValue(teamId);
        leaderboard.push({
          teamId,
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
    return findByStatus(CompetitionStatus.PENDING);
  }
}
