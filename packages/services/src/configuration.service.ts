import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { SelectCompetition } from "@recallnet/db/schema/core/types";

/**
 * Configuration Service
 * Manages dynamic configuration settings loaded from the database
 */
export class ConfigurationService {
  private competitionRepo: CompetitionRepository;
  private logger: Logger;

  constructor(competitionRepo: CompetitionRepository, logger: Logger) {
    this.competitionRepo = competitionRepo;
    this.logger = logger;
  }
  /**
   * Load competition-specific settings and update global configuration
   * This method updates the global features object with settings from the active competition
   */
  async loadCompetitionSettings(
    callback: (
      activeCompetition?: Awaited<
        ReturnType<typeof this.competitionRepo.findActive>
      >,
    ) => void,
  ): Promise<void> {
    try {
      // Get the active competition from the database
      const activeCompetition = await this.competitionRepo.findActive();
      callback(activeCompetition);
    } catch (error) {
      this.logger.error(
        "[ConfigurationService] Error loading competition settings:",
        error,
      );
    }
  }
}
