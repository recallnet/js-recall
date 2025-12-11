import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";

import type { CompetitionRepository } from "@recallnet/db/repositories/competition";
import type { PaperTradingConfigRepository } from "@recallnet/db/repositories/paper-trading-config";
import type { PaperTradingInitialBalancesRepository } from "@recallnet/db/repositories/paper-trading-initial-balances";
import type { TradingConstraintsRepository } from "@recallnet/db/repositories/trading-constraints";
import { competitions } from "@recallnet/db/schema/core/defs";
import type { Transaction } from "@recallnet/db/types";

import type {
  CreateCompetitionParams,
  CreateCompetitionResult,
  CreatePaperTradingCompetitionParams,
  ICompetitionService,
  SpecificChain,
  TradingConstraintsInput,
} from "../shared/competition.interface.js";

/**
 * Configuration for resolving token addresses from symbols
 */
export interface SpecificChainTokens {
  [chain: string]: {
    [tokenSymbol: string]: string;
  };
}

/**
 * Paper Trading Competition Service
 * Handles paper trading specific configuration for competitions (type: "trading")
 * The coordinator calls the base service first, then this service for type-specific logic
 */
export class PaperTradingCompetitionService implements ICompetitionService {
  private competitionRepo: CompetitionRepository;
  private paperTradingConfigRepo: PaperTradingConfigRepository;
  private paperTradingInitialBalancesRepo: PaperTradingInitialBalancesRepository;
  private tradingConstraintsRepo: TradingConstraintsRepository;
  private specificChainTokens: SpecificChainTokens;

  constructor(
    competitionRepo: CompetitionRepository,
    paperTradingConfigRepo: PaperTradingConfigRepository,
    paperTradingInitialBalancesRepo: PaperTradingInitialBalancesRepository,
    tradingConstraintsRepo: TradingConstraintsRepository,
    specificChainTokens: SpecificChainTokens,
  ) {
    this.competitionRepo = competitionRepo;
    this.paperTradingConfigRepo = paperTradingConfigRepo;
    this.paperTradingInitialBalancesRepo = paperTradingInitialBalancesRepo;
    this.tradingConstraintsRepo = tradingConstraintsRepo;
    this.specificChainTokens = specificChainTokens;
  }

  /**
   * Creates paper trading specific configuration for a competition
   * Called by the coordinator after the base competition is created.
   * This method finds the competition that was just created and sets up paper trading specific configuration.
   * @param params Parameters for creating the competition (must have type: "trading")
   * @param tx Database transaction
   * @returns Promise resolving to the created competition result
   */
  async createCompetition(
    params: CreateCompetitionParams,
    tx: Transaction,
  ): Promise<CreateCompetitionResult> {
    // Validate that this is a paper trading competition
    const competitionType = params.type ?? "trading";
    if (competitionType !== "trading") {
      // Return early for non-trading competitions - this service only handles trading
      // The coordinator will handle other types with their respective services
      return {
        id: "", // Will be set by coordinator from base service result
        status: "pending",
      };
    }

    // Type-safe params for paper trading
    const paperTradingParams = params as CreatePaperTradingCompetitionParams;

    // Validate initialBalances is provided for paper trading competitions
    if (
      !paperTradingParams.initialBalances ||
      paperTradingParams.initialBalances.length === 0
    ) {
      throw new Error(
        "initialBalances is required for paper trading competitions",
      );
    }

    // Find the competition that was just created by the base service
    // The base service creates it with the name and arenaId from params
    // Since we're in the same transaction, we can query for it
    const competition = await this.findCompetitionByNameAndArenaId(
      params.name,
      params.arenaId,
      tx,
    );

    if (!competition) {
      throw new Error(
        `Competition "${params.name}" not found. The base service should have created it first.`,
      );
    }

    // Set up paper trading specific configuration
    await this.createPaperTradingConfig(competition.id, paperTradingParams, tx);

    return {
      id: competition.id,
      status: competition.status,
    };
  }

  /**
   * Creates paper trading specific configuration for an existing competition
   * Sets up trading constraints, paper trading config, and initial balances.
   * @param competitionId The competition ID (already created by base service)
   * @param params Paper trading specific parameters
   * @param tx Database transaction
   */
  private async createPaperTradingConfig(
    competitionId: string,
    params: CreatePaperTradingCompetitionParams,
    tx: Transaction,
  ): Promise<void> {
    // Create trading constraints (with defaults if not provided)
    await this.createTradingConstraints(competitionId, params.constraints, tx);

    // Create paper trading config if provided
    if (params.config) {
      await this.paperTradingConfigRepo.upsert(
        {
          competitionId,
          maxTradePercentage: params.config.maxTradePercentage ?? 25,
        },
        tx,
      );
    }

    // Upsert paper trading initial balances
    await this.upsertPaperTradingInitialBalances(
      competitionId,
      params.initialBalances!,
      tx,
    );
  }

  /**
   * Finds a competition by name and arenaId within a transaction
   * @param name Competition name
   * @param arenaId Arena ID
   * @param tx Database transaction
   * @returns Competition or null if not found
   */
  private async findCompetitionByNameAndArenaId(
    name: string,
    arenaId: string,
    tx: Transaction,
  ) {
    const [result] = await tx
      .select()
      .from(competitions)
      .where(
        and(eq(competitions.name, name), eq(competitions.arenaId, arenaId)),
      )
      .limit(1);

    return result || null;
  }

  /**
   * Creates trading constraints for a competition with defaults
   * @param competitionId The competition ID
   * @param constraints Optional trading constraints (defaults applied if not provided)
   * @param tx Database transaction
   */
  private async createTradingConstraints(
    competitionId: string,
    constraints: TradingConstraintsInput | undefined,
    tx: Transaction,
  ): Promise<void> {
    // Default values for trading constraints
    const defaultConstraints = {
      minimumPairAgeHours: 24,
      minimum24hVolumeUsd: 10000,
      minimumLiquidityUsd: 50000,
      minimumFdvUsd: 1000000,
    };

    // Merge provided constraints with defaults
    const finalConstraints = {
      ...defaultConstraints,
      ...constraints,
    };

    await this.tradingConstraintsRepo.create(
      {
        competitionId,
        minimumPairAgeHours: finalConstraints.minimumPairAgeHours,
        minimum24hVolumeUsd: finalConstraints.minimum24hVolumeUsd,
        minimumLiquidityUsd: finalConstraints.minimumLiquidityUsd,
        minimumFdvUsd: finalConstraints.minimumFdvUsd,
      },
      tx,
    );
  }

  /**
   * Upserts paper trading initial balances for a competition
   * Derives tokenAddress from specificChainTokens based on specificChain and tokenSymbol
   * @param competitionId The competition ID
   * @param initialBalances Array of initial balances (specificChain, tokenSymbol, amount)
   * @param tx Database transaction
   */
  private async upsertPaperTradingInitialBalances(
    competitionId: string,
    initialBalances: Array<{
      specificChain: string;
      tokenSymbol: string;
      amount: number;
    }>,
    tx: Transaction,
  ): Promise<void> {
    if (!this.specificChainTokens) {
      throw new Error(
        "specificChainTokens configuration is required to process initialBalances",
      );
    }

    for (const balance of initialBalances) {
      const chainTokens =
        this.specificChainTokens[balance.specificChain as SpecificChain];
      if (!chainTokens) {
        throw new Error(
          `No token configuration found for chain: ${balance.specificChain}`,
        );
      }

      const tokenAddress =
        chainTokens[
          balance.tokenSymbol.toLowerCase() as keyof typeof chainTokens
        ];
      if (!tokenAddress) {
        throw new Error(
          `No token address found for ${balance.specificChain} ${balance.tokenSymbol}. Available tokens: ${Object.keys(chainTokens).join(", ")}`,
        );
      }

      await this.paperTradingInitialBalancesRepo.upsert(
        {
          id: randomUUID(),
          competitionId,
          specificChain: balance.specificChain,
          tokenSymbol: balance.tokenSymbol,
          tokenAddress: tokenAddress as string,
          amount: balance.amount,
        },
        tx,
      );
    }
  }
}
