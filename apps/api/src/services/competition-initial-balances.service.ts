import { v4 as uuidv4 } from "uuid";

import {
  InsertCompetitionInitialBalance,
  SelectCompetitionInitialBalance,
} from "@recallnet/db-schema/trading/types";

import { config } from "@/config/index.js";
import * as repository from "@/database/repositories/competition-initial-balances-repository.js";
import { serviceLogger } from "@/lib/logger.js";
import { SpecificChain } from "@/types/index.js";

export interface InitialBalanceInput {
  specificChain: SpecificChain;
  tokenSymbol: string;
  amount: number;
}

/**
 * Service for managing competition initial token balances
 */
export class CompetitionInitialBalancesService {
  /**
   * Creates initial balances for a competition
   */
  async createInitialBalances(
    competitionId: string,
    balances?: InitialBalanceInput[],
  ): Promise<SelectCompetitionInitialBalance[]> {
    // Use provided balances or default from config
    const balancesToCreate = balances || this.getDefaultBalances();

    if (balancesToCreate.length === 0) {
      serviceLogger.warn(
        `[CompetitionInitialBalancesService] No initial balances to create for competition ${competitionId}`,
      );
      return [];
    }

    const data: InsertCompetitionInitialBalance[] = balancesToCreate.map(
      (balance) => ({
        id: uuidv4(),
        competitionId,
        specificChain: balance.specificChain,
        tokenSymbol: balance.tokenSymbol,
        tokenAddress: this.getTokenAddress(
          balance.specificChain,
          balance.tokenSymbol,
        ),
        amount: balance.amount,
      }),
    );

    serviceLogger.debug(
      `[CompetitionInitialBalancesService] Creating ${data.length} initial balances for competition ${competitionId}`,
    );

    return repository.createBulk(data);
  }

  /**
   * Gets initial balances for a competition
   */
  async getInitialBalances(
    competitionId: string,
  ): Promise<SelectCompetitionInitialBalance[]> {
    return repository.findByCompetitionId(competitionId);
  }

  /**
   * Gets a specific initial balance
   */
  async getInitialBalance(
    competitionId: string,
    specificChain: SpecificChain,
    tokenSymbol: string,
  ): Promise<SelectCompetitionInitialBalance | null> {
    return repository.findByCompetitionChainToken(
      competitionId,
      specificChain,
      tokenSymbol,
    );
  }

  /**
   * Updates initial balances for a competition
   */
  async updateInitialBalances(
    competitionId: string,
    balances: InitialBalanceInput[],
  ): Promise<SelectCompetitionInitialBalance[]> {
    serviceLogger.debug(
      `[CompetitionInitialBalancesService] Updating initial balances for competition ${competitionId}`,
    );

    // Delete existing and create new
    await repository.deleteByCompetitionId(competitionId);
    return this.createInitialBalances(competitionId, balances);
  }

  /**
   * Upserts initial balances for a competition
   */
  async upsertInitialBalances(
    competitionId: string,
    balances: InitialBalanceInput[],
  ): Promise<SelectCompetitionInitialBalance[]> {
    const data: InsertCompetitionInitialBalance[] = balances.map((balance) => ({
      id: uuidv4(),
      competitionId,
      specificChain: balance.specificChain,
      tokenSymbol: balance.tokenSymbol,
      tokenAddress: this.getTokenAddress(
        balance.specificChain,
        balance.tokenSymbol,
      ),
      amount: balance.amount,
    }));

    serviceLogger.debug(
      `[CompetitionInitialBalancesService] Upserting ${data.length} initial balances for competition ${competitionId}`,
    );

    return repository.upsertBulk(data);
  }

  /**
   * Deletes all initial balances for a competition
   */
  async deleteInitialBalances(competitionId: string): Promise<number> {
    serviceLogger.debug(
      `[CompetitionInitialBalancesService] Deleting initial balances for competition ${competitionId}`,
    );

    return repository.deleteByCompetitionId(competitionId);
  }

  /**
   * Gets default balances from current config
   */
  private getDefaultBalances(): InitialBalanceInput[] {
    const balances: InitialBalanceInput[] = [];
    const specificChainBalances = config.specificChainBalances;

    Object.entries(specificChainBalances).forEach(([chain, tokens]) => {
      Object.entries(tokens).forEach(([symbol, amount]) => {
        if (amount > 0) {
          balances.push({
            specificChain: chain as SpecificChain,
            tokenSymbol: symbol,
            amount,
          });
        }
      });
    });

    return balances;
  }

  /**
   * Gets token address for a specific chain and symbol
   */
  private getTokenAddress(chain: SpecificChain, symbol: string): string {
    // Check if this specific chain exists in our config
    if (!(chain in config.specificChainTokens)) {
      throw new Error(`No token configuration for chain: ${chain}`);
    }

    const chainTokens =
      config.specificChainTokens[
      chain as keyof typeof config.specificChainTokens
      ];

    const address = chainTokens[symbol as keyof typeof chainTokens];
    if (!address) {
      throw new Error(`No token address for ${symbol} on ${chain}`);
    }

    return address;
  }

  /**
   * Gets initial balances as a map for balance manager
   */
  async getInitialBalancesMap(
    competitionId: string,
  ): Promise<Map<string, { amount: number; symbol: string }>> {
    const balances = await this.getInitialBalances(competitionId);

    // If no balances found, use defaults
    if (balances.length === 0) {
      serviceLogger.debug(
        `[CompetitionInitialBalancesService] No balances found for competition ${competitionId}, using defaults`,
      );
      const defaultBalances = this.getDefaultBalances();
      const balanceMap = new Map<string, { amount: number; symbol: string }>();

      defaultBalances.forEach((balance) => {
        const address = this.getTokenAddress(
          balance.specificChain,
          balance.tokenSymbol,
        );
        balanceMap.set(address, {
          amount: balance.amount,
          symbol: balance.tokenSymbol,
        });
      });

      return balanceMap;
    }

    const balanceMap = new Map<string, { amount: number; symbol: string }>();

    balances.forEach((balance) => {
      balanceMap.set(balance.tokenAddress, {
        amount: balance.amount,
        symbol: balance.tokenSymbol,
      });
    });

    return balanceMap;
  }

  /**
   * Validates that initial balance values are reasonable
   */
  validateInitialBalances(balances: InitialBalanceInput[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for duplicates
    const seen = new Set<string>();
    for (const balance of balances) {
      const key = `${balance.specificChain}-${balance.tokenSymbol}`;
      if (seen.has(key)) {
        errors.push(
          `Duplicate balance entry for ${balance.tokenSymbol} on ${balance.specificChain}`,
        );
      }
      seen.add(key);
    }

    // Validate each balance
    for (const balance of balances) {
      if (balance.amount < 0) {
        errors.push(`Amount for ${balance.tokenSymbol} must be non-negative`);
      }

      // Check if token exists in config
      try {
        this.getTokenAddress(balance.specificChain, balance.tokenSymbol);
      } catch {
        errors.push(
          `Invalid token ${balance.tokenSymbol} on chain ${balance.specificChain}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
