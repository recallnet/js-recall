import { config } from "@/config/index.js";
import * as repository from "@/database/repositories/competition-configuration-repository.js";
import {
  InsertCompetitionConfiguration,
  SelectCompetitionConfiguration,
} from "@/database/schema/trading/types.js";
import { serviceLogger } from "@/lib/logger.js";

export interface CompetitionConfigurationInput {
  competitionId: string;
  maxTradePercentage?: number;
}

/**
 * Service for managing competition runtime configurations
 */
export class CompetitionConfigurationService {
  /**
   * Creates configuration for a competition with defaults
   */
  async createConfiguration(
    input: CompetitionConfigurationInput,
  ): Promise<SelectCompetitionConfiguration | undefined> {
    const data: InsertCompetitionConfiguration = {
      competitionId: input.competitionId,
      maxTradePercentage: input.maxTradePercentage ?? config.maxTradePercentage,
    };

    serviceLogger.debug(
      `[CompetitionConfigurationService] Creating configuration for competition ${input.competitionId}`,
    );

    return repository.create(data);
  }

  /**
   * Gets configuration for a competition
   */
  async getConfiguration(
    competitionId: string,
  ): Promise<SelectCompetitionConfiguration | null> {
    return repository.findByCompetitionId(competitionId);
  }

  /**
   * Updates configuration for a competition
   */
  async updateConfiguration(
    competitionId: string,
    input: Partial<CompetitionConfigurationInput>,
  ): Promise<SelectCompetitionConfiguration | undefined> {
    serviceLogger.debug(
      `[CompetitionConfigurationService] Updating configuration for competition ${competitionId}`,
    );

    return repository.update(competitionId, input);
  }

  /**
   * Creates or updates configuration
   */
  async upsertConfiguration(
    input: CompetitionConfigurationInput,
  ): Promise<SelectCompetitionConfiguration | undefined> {
    // First, try to get existing configuration
    const existingConfig = await repository.findByCompetitionId(
      input.competitionId,
    );

    const data: InsertCompetitionConfiguration = {
      competitionId: input.competitionId,
      maxTradePercentage:
        input.maxTradePercentage ??
        existingConfig?.maxTradePercentage ??
        config.maxTradePercentage,
    };

    serviceLogger.debug(
      `[CompetitionConfigurationService] Upserting configuration for competition ${input.competitionId}`,
    );

    return repository.upsert(data);
  }

  /**
   * Deletes configuration for a competition
   */
  async deleteConfiguration(competitionId: string): Promise<boolean> {
    serviceLogger.debug(
      `[CompetitionConfigurationService] Deleting configuration for competition ${competitionId}`,
    );

    return repository.deleteConfiguration(competitionId);
  }

  /**
   * Gets configuration with defaults
   */
  async getConfigurationWithDefaults(competitionId: string): Promise<{
    maxTradePercentage: number;
  }> {
    const configuration = await this.getConfiguration(competitionId);

    return {
      maxTradePercentage:
        configuration?.maxTradePercentage ?? config.maxTradePercentage,
    };
  }

  /**
   * Validates that configuration values are reasonable
   */
  validateConfiguration(input: CompetitionConfigurationInput): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (input.maxTradePercentage !== undefined) {
      if (input.maxTradePercentage < 1) {
        errors.push("maxTradePercentage must be at least 1%");
      }
      if (input.maxTradePercentage > 100) {
        errors.push("maxTradePercentage cannot exceed 100%");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
