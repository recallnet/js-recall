import {
  findByStatus,
} from "@/database/repositories/competition-repository.js";
import {
  BalanceManager,
  ConfigurationService,
  PortfolioSnapshotter,
  TeamManager,
  TradeSimulator,
} from "@/services/index.js";
import {
  AuthenticatedRequest,
  CompetitionStatusSchema,
  PagingParamsSchema,
} from "@/types/index.js";

/**
 * Competitions Manager Service
 * Manages trading competitions
 */
export class CompetitionsManager {
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
  }

  /**
   * Load the active competition from the database
   * This is used at startup to restore the active competition state
   */
  async getCompetitions(req: AuthenticatedRequest) {
    return await findByStatus(
      CompetitionStatusSchema.parse(req.query.status),
      PagingParamsSchema.parse(req.query),
    );
  }
}
