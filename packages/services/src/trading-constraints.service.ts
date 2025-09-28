import { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";
import {
  InsertTradingConstraints,
  SelectTradingConstraints,
} from "@recallnet/db/schema/trading/types";
import { Transaction } from "@recallnet/db/types";

export interface TradingConstraintsInput {
  competitionId: string;
  minimumPairAgeHours?: number;
  minimum24hVolumeUsd?: number;
  minimumLiquidityUsd?: number;
  minimumFdvUsd?: number;
  minTradesPerDay?: number | null;
}

/**
 * Service for managing trading constraints
 */
export class TradingConstraintsService {
  private tradingConstraintsRepo: TradingConstraintsRepository;
  private defaultMinimumPairAgeHours: number;
  private defaultMinimum24hVolumeUsd: number;
  private defaultMinimumLiquidityUsd: number;
  private defaultMinimumFdvUsd: number;

  constructor(
    tradingConstraintsRepo: TradingConstraintsRepository,
    defaultMinimumPairAgeHours: number,
    defaultMinimum24hVolumeUsd: number,
    defaultMinimumLiquidityUsd: number,
    defaultMinimumFdvUsd: number,
  ) {
    this.tradingConstraintsRepo = tradingConstraintsRepo;
    this.defaultMinimumPairAgeHours = defaultMinimumPairAgeHours;
    this.defaultMinimum24hVolumeUsd = defaultMinimum24hVolumeUsd;
    this.defaultMinimumLiquidityUsd = defaultMinimumLiquidityUsd;
    this.defaultMinimumFdvUsd = defaultMinimumFdvUsd;
  }

  /**
   * Creates trading constraints for a competition
   * @param input The trading constraints input
   * @param tx Optional database transaction
   * @returns The created trading constraints
   */
  async createConstraints(
    input: TradingConstraintsInput,
    tx?: Transaction,
  ): Promise<SelectTradingConstraints | undefined> {
    const constraintsData: InsertTradingConstraints = {
      competitionId: input.competitionId,
      minimumPairAgeHours:
        input.minimumPairAgeHours ?? this.defaultMinimumPairAgeHours,
      minimum24hVolumeUsd:
        input.minimum24hVolumeUsd ?? this.defaultMinimum24hVolumeUsd,
      minimumLiquidityUsd:
        input.minimumLiquidityUsd ?? this.defaultMinimumLiquidityUsd,
      minimumFdvUsd: input.minimumFdvUsd ?? this.defaultMinimumFdvUsd,
      minTradesPerDay: input.minTradesPerDay ?? null,
    };

    return await this.tradingConstraintsRepo.create(constraintsData, tx);
  }

  /**
   * Gets trading constraints for a competition
   */
  async getConstraints(
    competitionId: string,
  ): Promise<SelectTradingConstraints | null> {
    return await this.tradingConstraintsRepo.findByCompetitionId(competitionId);
  }

  /**
   * Updates trading constraints for a competition
   */
  async updateConstraints(
    competitionId: string,
    input: Partial<TradingConstraintsInput>,
    tx?: Transaction,
  ): Promise<SelectTradingConstraints> {
    const updateData: Partial<InsertTradingConstraints> = {};

    if (input.minimumPairAgeHours !== undefined) {
      updateData.minimumPairAgeHours = input.minimumPairAgeHours;
    }
    if (input.minimum24hVolumeUsd !== undefined) {
      updateData.minimum24hVolumeUsd = input.minimum24hVolumeUsd;
    }
    if (input.minimumLiquidityUsd !== undefined) {
      updateData.minimumLiquidityUsd = input.minimumLiquidityUsd;
    }
    if (input.minimumFdvUsd !== undefined) {
      updateData.minimumFdvUsd = input.minimumFdvUsd;
    }
    if (input.minTradesPerDay !== undefined) {
      updateData.minTradesPerDay = input.minTradesPerDay;
    }

    const result = await this.tradingConstraintsRepo.update(
      competitionId,
      updateData,
      tx,
    );
    if (!result) {
      throw new Error(
        `Failed to update trading constraints for competition ${competitionId}`,
      );
    }
    return result;
  }

  /**
   * Deletes trading constraints for a competition
   */
  async deleteConstraints(competitionId: string): Promise<boolean> {
    return await this.tradingConstraintsRepo.delete(competitionId);
  }

  /**
   * Upserts trading constraints for a competition
   */
  async upsertConstraints(
    input: TradingConstraintsInput,
  ): Promise<SelectTradingConstraints> {
    const constraintsData: InsertTradingConstraints = {
      competitionId: input.competitionId,
      minimumPairAgeHours:
        input.minimumPairAgeHours ?? this.defaultMinimumPairAgeHours,
      minimum24hVolumeUsd:
        input.minimum24hVolumeUsd ?? this.defaultMinimum24hVolumeUsd,
      minimumLiquidityUsd:
        input.minimumLiquidityUsd ?? this.defaultMinimumLiquidityUsd,
      minimumFdvUsd: input.minimumFdvUsd ?? this.defaultMinimumFdvUsd,
      minTradesPerDay: input.minTradesPerDay ?? null,
    };

    const result = await this.tradingConstraintsRepo.upsert(constraintsData);
    if (!result) {
      throw new Error(
        `Failed to upsert trading constraints for competition ${input.competitionId}`,
      );
    }
    return result;
  }

  /**
   * Gets constraints with defaults if not set
   */
  async getConstraintsWithDefaults(competitionId: string): Promise<{
    minimumPairAgeHours: number;
    minimum24hVolumeUsd: number;
    minimumLiquidityUsd: number;
    minimumFdvUsd: number;
    minTradesPerDay: number | null;
  }> {
    const constraints = await this.getConstraints(competitionId);

    if (constraints) {
      return {
        minimumPairAgeHours: constraints.minimumPairAgeHours,
        minimum24hVolumeUsd: constraints.minimum24hVolumeUsd,
        minimumLiquidityUsd: constraints.minimumLiquidityUsd,
        minimumFdvUsd: constraints.minimumFdvUsd,
        minTradesPerDay: constraints.minTradesPerDay,
      };
    }

    return {
      minimumPairAgeHours: this.defaultMinimumPairAgeHours,
      minimum24hVolumeUsd: this.defaultMinimum24hVolumeUsd,
      minimumLiquidityUsd: this.defaultMinimumLiquidityUsd,
      minimumFdvUsd: this.defaultMinimumFdvUsd,
      minTradesPerDay: null,
    };
  }

  /**
   * Validates that constraint values are reasonable
   */
  validateConstraints(input: TradingConstraintsInput): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (input.minimumPairAgeHours !== undefined) {
      if (input.minimumPairAgeHours < 0) {
        errors.push("minimumPairAgeHours must be non-negative");
      }
      if (input.minimumPairAgeHours > 8760) {
        // 1 year
        errors.push("minimumPairAgeHours cannot exceed 8760 hours (1 year)");
      }
    }

    if (input.minimum24hVolumeUsd !== undefined) {
      if (input.minimum24hVolumeUsd < 0) {
        errors.push("minimum24hVolumeUsd must be non-negative");
      }
      if (input.minimum24hVolumeUsd > 1000000000) {
        // 1 billion
        errors.push("minimum24hVolumeUsd cannot exceed 1 billion USD");
      }
    }

    if (input.minimumLiquidityUsd !== undefined) {
      if (input.minimumLiquidityUsd < 0) {
        errors.push("minimumLiquidityUsd must be non-negative");
      }
      if (input.minimumLiquidityUsd > 1000000000) {
        // 1 billion
        errors.push("minimumLiquidityUsd cannot exceed 1 billion USD");
      }
    }

    if (input.minimumFdvUsd !== undefined) {
      if (input.minimumFdvUsd < 0) {
        errors.push("minimumFdvUsd must be non-negative");
      }
      if (input.minimumFdvUsd > 1000000000000) {
        // 1 trillion
        errors.push("minimumFdvUsd cannot exceed 1 trillion USD");
      }
    }

    if (input.minTradesPerDay !== undefined && input.minTradesPerDay !== null) {
      if (input.minTradesPerDay < 0) {
        errors.push("minTradesPerDay must be non-negative");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
