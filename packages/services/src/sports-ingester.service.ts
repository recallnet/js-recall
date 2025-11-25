import { Logger } from "pino";

import { SportsDataIONflProvider } from "./providers/sportsdataio.provider.js";
import { NflIngesterService } from "./sports-nfl-ingester.service.js";
import { SportsService } from "./sports.service.js";
import type { SportsProviderConfig } from "./types/sports.js";

/**
 * Configuration for SportsIngesterService
 */
export interface SportsIngesterServiceConfig {
  sportsDataApi: SportsProviderConfig;
}

/**
 * SportsIngesterService
 * Composes provider-backed ingest utilities for fetching and persisting sports data
 * Wraps write-capable services so consumer surfaces can remain configuration-light
 */
export class SportsIngesterService {
  readonly sportsDataIOProvider: SportsDataIONflProvider;
  readonly nflIngesterService: NflIngesterService;

  constructor(
    sportsService: SportsService,
    logger: Logger,
    config: SportsIngesterServiceConfig,
  ) {
    this.sportsDataIOProvider = new SportsDataIONflProvider(
      config.sportsDataApi,
      logger,
    );

    this.nflIngesterService = new NflIngesterService(
      sportsService.db,
      sportsService.gamesRepository,
      sportsService.gamePlaysRepository,
      sportsService.gamePredictionsRepository,
      sportsService.competitionRepository,
      sportsService.competitionGamesRepository,
      sportsService.gameScoringService,
      this.sportsDataIOProvider,
      logger,
    );
  }
}
