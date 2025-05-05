import { BalanceRepository } from "./balance-repository.js";
import { CompetitionRepository } from "./competition-repository.js";
import { PriceRepository } from "./price-repository.js";
import { TeamRepository } from "./team-repository.js";
import { TradeRepository } from "./trade-repository.js";

/**
 * Repository Registry
 * Manages all repository instances
 */
class RepositoryRegistry {
  private static instance: RepositoryRegistry;

  private _teamRepository: TeamRepository;
  private _competitionRepository: CompetitionRepository;
  private _balanceRepository: BalanceRepository;
  private _tradeRepository: TradeRepository;
  private _priceRepository: PriceRepository;

  private constructor() {
    this._teamRepository = new TeamRepository();
    this._competitionRepository = new CompetitionRepository();
    this._balanceRepository = new BalanceRepository();
    this._tradeRepository = new TradeRepository();
    this._priceRepository = new PriceRepository();

    console.log("[RepositoryRegistry] All repositories initialized");
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RepositoryRegistry {
    if (!RepositoryRegistry.instance) {
      RepositoryRegistry.instance = new RepositoryRegistry();
    }
    return RepositoryRegistry.instance;
  }

  get teamRepository(): TeamRepository {
    return this._teamRepository;
  }

  get competitionRepository(): CompetitionRepository {
    return this._competitionRepository;
  }

  get balanceRepository(): BalanceRepository {
    return this._balanceRepository;
  }

  get tradeRepository(): TradeRepository {
    return this._tradeRepository;
  }

  get priceRepository(): PriceRepository {
    return this._priceRepository;
  }
}

// Export the repository registry instance
export const repositories = RepositoryRegistry.getInstance();

// Export repository types for convenience
export {
  TeamRepository,
  CompetitionRepository,
  BalanceRepository,
  TradeRepository,
  PriceRepository,
};
