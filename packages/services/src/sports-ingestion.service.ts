import { Logger } from "pino";

import { SportsDataIONflProvider } from "./providers/sportsdataio.provider.js";
import { NflIngestorService } from "./sports-nfl-ingestor.service.js";
import { SportsService } from "./sports.service.js";
import type { SportsProviderConfig } from "./types/sports.js";

/**
 * Configuration for SportsIngestionService
 */
export interface SportsIngestionServiceConfig {
  sportsDataApi: SportsProviderConfig;
}

/**
 * SportsIngestionService
 * Composes provider-backed ingest utilities for fetching and persisting sports data
 * Wraps write-capable services so consumer surfaces can remain configuration-light
 */
export class SportsIngestionService {
  readonly sportsDataIOProvider: SportsDataIONflProvider;
  readonly nflIngestorService: NflIngestorService;

  constructor(
    sportsService: SportsService,
    logger: Logger,
    config: SportsIngestionServiceConfig,
  ) {
    this.sportsDataIOProvider = new SportsDataIONflProvider(
      config.sportsDataApi,
      logger,
    );

    this.nflIngestorService = new NflIngestorService(
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
