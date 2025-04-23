import { TeamRepository } from './team-repository';
import { CompetitionRepository } from './competition-repository';
import { BalanceRepository } from './balance-repository';
import { TradeRepository } from './trade-repository';
import { PriceRepository } from './price-repository';

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

    console.log('[RepositoryRegistry] All repositories initialized');
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
