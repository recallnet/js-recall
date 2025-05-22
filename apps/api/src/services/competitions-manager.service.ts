import { findByStatus } from "@/database/repositories/competition-repository.js";
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
