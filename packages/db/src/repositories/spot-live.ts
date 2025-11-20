import {
  and,
  desc,
  count as drizzleCount,
  eq,
  gt,
  inArray,
  sql,
} from "drizzle-orm";
import { Logger } from "pino";

import { agents } from "../schema/core/defs.js";
import {
  spotLiveAllowedProtocols,
  spotLiveAllowedTokens,
  spotLiveCompetitionChains,
  spotLiveCompetitionConfig,
  spotLiveSelfFundingAlerts,
  spotLiveTransferHistory,
} from "../schema/trading/defs.js";
import type {
  InsertSpotLiveAllowedProtocol,
  InsertSpotLiveAllowedToken,
  InsertSpotLiveCompetitionConfig,
  InsertSpotLiveSelfFundingAlert,
  InsertSpotLiveTransferHistory,
  SelectSpotLiveAllowedProtocol,
  SelectSpotLiveAllowedToken,
  SelectSpotLiveCompetitionChain,
  SelectSpotLiveCompetitionConfig,
  SelectSpotLiveSelfFundingAlert,
  SelectSpotLiveTransferHistory,
} from "../schema/trading/types.js";
import { Database, Transaction } from "../types.js";
import type { SpecificChain } from "./types/index.js";

/**
 * Review data for self-funding alerts
 */
export interface SpotLiveSelfFundingAlertReview {
  reviewed: boolean;
  reviewedBy: string | null;
  reviewNote: string | null;
  actionTaken: string | null;
  reviewedAt: Date;
}

/**
 * Spot Live Repository
 * Handles database operations for spot live trading competitions
 */
export class SpotLiveRepository {
  readonly #db: Database;
  readonly #dbRead: Database;
  readonly #logger: Logger;

  constructor(database: Database, readDatabase: Database, logger: Logger) {
    this.#db = database;
    this.#dbRead = readDatabase;
    this.#logger = logger;
  }

  // =============================================================================
  // SPOT LIVE COMPETITION CONFIG
  // =============================================================================

  /**
   * Create spot live competition configuration
   * @param config Configuration to create
   * @param tx Optional transaction
   * @returns Created configuration
   */
  async createSpotLiveCompetitionConfig(
    config: InsertSpotLiveCompetitionConfig,
    tx?: Transaction,
  ): Promise<SelectSpotLiveCompetitionConfig> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .insert(spotLiveCompetitionConfig)
        .values(config)
        .returning();

      if (!result) {
        throw new Error("Failed to create spot live competition config");
      }

      this.#logger.debug(
        `[SpotLiveRepository] Created spot live config for competition ${config.competitionId}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in createSpotLiveCompetitionConfig");
      throw error;
    }
  }

  /**
   * Get spot live competition configuration
   * @param competitionId Competition ID
   * @returns Configuration or null if not found
   */
  async getSpotLiveCompetitionConfig(
    competitionId: string,
  ): Promise<SelectSpotLiveCompetitionConfig | null> {
    try {
      const [result] = await this.#dbRead
        .select()
        .from(spotLiveCompetitionConfig)
        .where(eq(spotLiveCompetitionConfig.competitionId, competitionId))
        .limit(1);

      return result || null;
    } catch (error) {
      this.#logger.error({ error }, "Error in getSpotLiveCompetitionConfig");
      throw error;
    }
  }

  /**
   * Update spot live competition configuration
   * @param competitionId Competition ID
   * @param updates Partial config updates
   * @param tx Optional transaction
   * @returns Updated configuration or null if not found
   */
  async updateSpotLiveCompetitionConfig(
    competitionId: string,
    updates: Partial<
      Omit<InsertSpotLiveCompetitionConfig, "competitionId" | "createdAt">
    >,
    tx?: Transaction,
  ): Promise<SelectSpotLiveCompetitionConfig | null> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .update(spotLiveCompetitionConfig)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(spotLiveCompetitionConfig.competitionId, competitionId))
        .returning();

      if (result) {
        this.#logger.debug(
          `[SpotLiveRepository] Updated spot live config for competition ${competitionId}`,
        );
      }

      return result || null;
    } catch (error) {
      this.#logger.error({ error }, "Error in updateSpotLiveCompetitionConfig");
      throw error;
    }
  }

  /**
   * Delete spot live competition configuration
   * @param competitionId Competition ID
   * @param tx Optional transaction
   * @returns True if deleted, false if not found
   */
  async deleteSpotLiveCompetitionConfig(
    competitionId: string,
    tx?: Transaction,
  ): Promise<boolean> {
    try {
      const executor = tx || this.#db;
      const result = await executor
        .delete(spotLiveCompetitionConfig)
        .where(eq(spotLiveCompetitionConfig.competitionId, competitionId));

      const deleted = (result?.rowCount ?? 0) > 0;

      if (deleted) {
        this.#logger.debug(
          `[SpotLiveRepository] Deleted spot live config for competition ${competitionId}`,
        );
      }

      return deleted;
    } catch (error) {
      this.#logger.error({ error }, "Error in deleteSpotLiveCompetitionConfig");
      throw error;
    }
  }

  // =============================================================================
  // COMPETITION CHAINS
  // =============================================================================

  /**
   * Batch create enabled chains for a competition
   * @param competitionId Competition ID
   * @param chains Array of chain configurations
   * @param tx Optional transaction
   * @returns Array of created chain records
   */
  async batchCreateCompetitionChains(
    competitionId: string,
    chains: Array<{ specificChain: SpecificChain; enabled: boolean }>,
    tx?: Transaction,
  ): Promise<SelectSpotLiveCompetitionChain[]> {
    if (chains.length === 0) {
      return [];
    }

    try {
      const executor = tx || this.#db;
      const results = await executor
        .insert(spotLiveCompetitionChains)
        .values(
          chains.map((chain) => ({
            competitionId,
            specificChain: chain.specificChain,
            enabled: chain.enabled,
          })),
        )
        .returning();

      this.#logger.debug(
        `[SpotLiveRepository] Created ${results.length} chains for competition ${competitionId}`,
      );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in batchCreateCompetitionChains");
      throw error;
    }
  }

  /**
   * Get enabled chains for a competition
   * @param competitionId Competition ID
   * @returns Array of enabled chain names
   */
  async getEnabledChains(competitionId: string): Promise<SpecificChain[]> {
    try {
      const results = await this.#dbRead
        .select({ specificChain: spotLiveCompetitionChains.specificChain })
        .from(spotLiveCompetitionChains)
        .where(
          and(
            eq(spotLiveCompetitionChains.competitionId, competitionId),
            eq(spotLiveCompetitionChains.enabled, true),
          ),
        );

      return results.map((r) => r.specificChain);
    } catch (error) {
      this.#logger.error({ error }, "Error in getEnabledChains");
      throw error;
    }
  }

  /**
   * Update chain enabled status
   * @param competitionId Competition ID
   * @param specificChain Chain to update
   * @param enabled New enabled status
   * @param tx Optional transaction
   * @returns Updated chain record or null if not found
   */
  async updateChainStatus(
    competitionId: string,
    specificChain: SpecificChain,
    enabled: boolean,
    tx?: Transaction,
  ): Promise<SelectSpotLiveCompetitionChain | null> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .update(spotLiveCompetitionChains)
        .set({ enabled })
        .where(
          and(
            eq(spotLiveCompetitionChains.competitionId, competitionId),
            eq(spotLiveCompetitionChains.specificChain, specificChain),
          ),
        )
        .returning();

      return result || null;
    } catch (error) {
      this.#logger.error({ error }, "Error in updateChainStatus");
      throw error;
    }
  }

  // =============================================================================
  // PROTOCOL WHITELIST
  // =============================================================================

  /**
   * Batch create allowed protocols for a competition
   * @param competitionId Competition ID
   * @param protocols Array of protocol configurations
   * @param tx Optional transaction
   * @returns Array of created protocol records
   */
  async batchCreateAllowedProtocols(
    competitionId: string,
    protocols: Omit<InsertSpotLiveAllowedProtocol, "competitionId">[],
    tx?: Transaction,
  ): Promise<SelectSpotLiveAllowedProtocol[]> {
    if (protocols.length === 0) {
      return [];
    }

    try {
      const executor = tx || this.#db;
      const results = await executor
        .insert(spotLiveAllowedProtocols)
        .values(
          protocols.map((protocol) => ({
            ...protocol,
            competitionId,
            routerAddress: protocol.routerAddress.toLowerCase(),
            factoryAddress: protocol.factoryAddress?.toLowerCase() || null,
          })),
        )
        .returning();

      this.#logger.debug(
        `[SpotLiveRepository] Created ${results.length} allowed protocols for competition ${competitionId}`,
      );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in batchCreateAllowedProtocols");
      throw error;
    }
  }

  /**
   * Get all allowed protocols for a competition
   * @param competitionId Competition ID
   * @returns Array of protocol configurations
   */
  async getAllowedProtocols(
    competitionId: string,
  ): Promise<SelectSpotLiveAllowedProtocol[]> {
    try {
      const results = await this.#dbRead
        .select()
        .from(spotLiveAllowedProtocols)
        .where(eq(spotLiveAllowedProtocols.competitionId, competitionId));

      this.#logger.debug(
        `[SpotLiveRepository] Retrieved ${results.length} allowed protocols for competition ${competitionId}`,
      );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in getAllowedProtocols");
      throw error;
    }
  }

  /**
   * Delete all allowed protocols for a competition
   * @param competitionId Competition ID
   * @param tx Optional transaction
   * @returns True if any deleted, false otherwise
   */
  async deleteAllowedProtocols(
    competitionId: string,
    tx?: Transaction,
  ): Promise<boolean> {
    try {
      const executor = tx || this.#db;
      const result = await executor
        .delete(spotLiveAllowedProtocols)
        .where(eq(spotLiveAllowedProtocols.competitionId, competitionId));

      const deleted = (result?.rowCount ?? 0) > 0;

      if (deleted) {
        this.#logger.debug(
          `[SpotLiveRepository] Deleted allowed protocols for competition ${competitionId}`,
        );
      }

      return deleted;
    } catch (error) {
      this.#logger.error({ error }, "Error in deleteAllowedProtocols");
      throw error;
    }
  }

  // =============================================================================
  // TOKEN WHITELIST
  // =============================================================================

  /**
   * Batch create allowed tokens for a competition
   * @param competitionId Competition ID
   * @param tokens Array of token configurations
   * @param tx Optional transaction
   * @returns Array of created token records
   */
  async batchCreateAllowedTokens(
    competitionId: string,
    tokens: Omit<InsertSpotLiveAllowedToken, "competitionId">[],
    tx?: Transaction,
  ): Promise<SelectSpotLiveAllowedToken[]> {
    if (tokens.length === 0) {
      return [];
    }

    try {
      const executor = tx || this.#db;
      const results = await executor
        .insert(spotLiveAllowedTokens)
        .values(
          tokens.map((token) => ({
            ...token,
            competitionId,
            tokenAddress: token.tokenAddress.toLowerCase(),
          })),
        )
        .returning();

      this.#logger.debug(
        `[SpotLiveRepository] Created ${results.length} allowed tokens for competition ${competitionId}`,
      );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in batchCreateAllowedTokens");
      throw error;
    }
  }

  /**
   * Get allowed token addresses grouped by chain for filtering
   * @param competitionId Competition ID
   * @returns Map of chain to Set of allowed token addresses (lowercase)
   */
  async getAllowedTokenAddresses(
    competitionId: string,
  ): Promise<Map<string, Set<string>>> {
    try {
      const tokens = await this.#dbRead
        .select()
        .from(spotLiveAllowedTokens)
        .where(eq(spotLiveAllowedTokens.competitionId, competitionId));

      const tokenMap = new Map<string, Set<string>>();

      for (const token of tokens) {
        const existing = tokenMap.get(token.specificChain);
        if (existing) {
          existing.add(token.tokenAddress);
        } else {
          tokenMap.set(token.specificChain, new Set([token.tokenAddress]));
        }
      }

      this.#logger.debug(
        `[SpotLiveRepository] Retrieved allowed tokens for ${tokenMap.size} chains in competition ${competitionId}`,
      );

      return tokenMap;
    } catch (error) {
      this.#logger.error({ error }, "Error in getAllowedTokenAddresses");
      throw error;
    }
  }

  /**
   * Get all allowed tokens with full metadata (for admin display)
   * @param competitionId Competition ID
   * @returns Array of token records with symbols and addresses
   */
  async getAllowedTokens(
    competitionId: string,
  ): Promise<SelectSpotLiveAllowedToken[]> {
    try {
      const results = await this.#dbRead
        .select()
        .from(spotLiveAllowedTokens)
        .where(eq(spotLiveAllowedTokens.competitionId, competitionId))
        .orderBy(
          spotLiveAllowedTokens.specificChain,
          spotLiveAllowedTokens.tokenSymbol,
        );

      return results;
    } catch (error) {
      this.#logger.error({ error }, "Error in getAllowedTokens");
      throw error;
    }
  }

  /**
   * Delete all allowed tokens for a competition
   * @param competitionId Competition ID
   * @param tx Optional transaction
   * @returns True if any deleted, false otherwise
   */
  async deleteAllowedTokens(
    competitionId: string,
    tx?: Transaction,
  ): Promise<boolean> {
    try {
      const executor = tx || this.#db;
      const result = await executor
        .delete(spotLiveAllowedTokens)
        .where(eq(spotLiveAllowedTokens.competitionId, competitionId));

      const deleted = (result?.rowCount ?? 0) > 0;

      if (deleted) {
        this.#logger.debug(
          `[SpotLiveRepository] Deleted allowed tokens for competition ${competitionId}`,
        );
      }

      return deleted;
    } catch (error) {
      this.#logger.error({ error }, "Error in deleteAllowedTokens");
      throw error;
    }
  }

  // =============================================================================
  // TRANSFER HISTORY OPERATIONS
  // =============================================================================

  /**
   * Save transfer history for violation detection and audit
   * @param transfer Transfer data
   * @param tx Optional transaction
   * @returns Created transfer record
   */
  async saveSpotLiveTransfer(
    transfer: InsertSpotLiveTransferHistory,
    tx?: Transaction,
  ): Promise<SelectSpotLiveTransferHistory> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .insert(spotLiveTransferHistory)
        .values({
          ...transfer,
          tokenAddress: transfer.tokenAddress.toLowerCase(),
          fromAddress: transfer.fromAddress.toLowerCase(),
          toAddress: transfer.toAddress.toLowerCase(),
        })
        .returning();

      if (!result) {
        throw new Error("Failed to save spot live transfer history");
      }

      this.#logger.debug(
        `[SpotLiveRepository] Saved transfer: agent=${transfer.agentId}, type=${transfer.type}, amount=${transfer.amount}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in saveSpotLiveTransfer");
      throw error;
    }
  }

  /**
   * Batch save transfers (used during sync operations)
   * @param transfers Array of transfer records
   * @returns Array of created transfer records
   */
  async batchSaveSpotLiveTransfers(
    transfers: InsertSpotLiveTransferHistory[],
  ): Promise<SelectSpotLiveTransferHistory[]> {
    if (transfers.length === 0) {
      return [];
    }

    try {
      const BATCH_SIZE = 500;
      const allResults: SelectSpotLiveTransferHistory[] = [];

      for (let i = 0; i < transfers.length; i += BATCH_SIZE) {
        const batch = transfers.slice(i, i + BATCH_SIZE);
        const results = await this.#db
          .insert(spotLiveTransferHistory)
          .values(
            batch.map((transfer) => ({
              ...transfer,
              tokenAddress: transfer.tokenAddress.toLowerCase(),
              fromAddress: transfer.fromAddress.toLowerCase(),
              toAddress: transfer.toAddress.toLowerCase(),
            })),
          )
          .onConflictDoNothing({ target: spotLiveTransferHistory.txHash })
          .returning();

        allResults.push(...results);
      }

      this.#logger.debug(
        `[SpotLiveRepository] Batch saved ${allResults.length} transfers in ${Math.ceil(transfers.length / BATCH_SIZE)} batches`,
      );

      return allResults;
    } catch (error) {
      this.#logger.error({ error }, "Error in batchSaveSpotLiveTransfers");
      throw error;
    }
  }

  /**
   * Get transfer history for an agent in a competition
   *
   * NOTE: This method intentionally has NO LIMIT on results. While this could
   * theoretically cause memory issues with thousands of transfers, in practice:
   * 1. Competitions are typically 1 week long
   * 2. Mid-competition transfers are violations - should be rare
   * 3. Even 100 transfers would only be ~10KB
   * 4. We need ALL transfers for violation detection and admin review
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param since Optional timestamp to get transfers after
   * @returns Array of transfer records
   */
  async getAgentSpotLiveTransfers(
    agentId: string,
    competitionId: string,
    since?: Date,
  ): Promise<SelectSpotLiveTransferHistory[]> {
    try {
      const conditions = [
        eq(spotLiveTransferHistory.agentId, agentId),
        eq(spotLiveTransferHistory.competitionId, competitionId),
      ];

      if (since) {
        conditions.push(
          sql`${spotLiveTransferHistory.transferTimestamp} > ${since}`,
        );
      }

      const transfers = await this.#dbRead
        .select()
        .from(spotLiveTransferHistory)
        .where(and(...conditions))
        .orderBy(spotLiveTransferHistory.transferTimestamp);

      this.#logger.debug(
        `[SpotLiveRepository] Retrieved ${transfers.length} transfers for agent ${agentId}`,
      );

      return transfers;
    } catch (error) {
      this.#logger.error({ error }, "Error in getAgentSpotLiveTransfers");
      throw error;
    }
  }

  /**
   * Get transfer violation counts for all agents in a competition with agent names
   * Uses SQL aggregation with JOIN
   * @param competitionId Competition ID
   * @param startDate Competition start date (only count transfers after this)
   * @returns Array of agents with transfer counts and names (only includes agents with violations)
   */
  async getCompetitionSpotLiveTransferViolationCounts(
    competitionId: string,
    startDate: Date,
  ): Promise<
    Array<{ agentId: string; agentName: string; transferCount: number }>
  > {
    try {
      const results = await this.#dbRead
        .select({
          agentId: spotLiveTransferHistory.agentId,
          agentName: agents.name,
          transferCount: drizzleCount(spotLiveTransferHistory.id),
        })
        .from(spotLiveTransferHistory)
        .leftJoin(agents, eq(spotLiveTransferHistory.agentId, agents.id))
        .where(
          and(
            eq(spotLiveTransferHistory.competitionId, competitionId),
            gt(spotLiveTransferHistory.transferTimestamp, startDate),
          ),
        )
        .groupBy(spotLiveTransferHistory.agentId, agents.name)
        .orderBy(desc(drizzleCount(spotLiveTransferHistory.id)));

      const mappedResults = results.map((row) => ({
        agentId: row.agentId,
        agentName: row.agentName ?? "Unknown Agent",
        transferCount: row.transferCount,
      }));

      this.#logger.debug(
        `[SpotLiveRepository] Found ${mappedResults.length} agents with transfer violations in competition ${competitionId}`,
      );

      return mappedResults;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in getCompetitionSpotLiveTransferViolationCounts",
      );
      throw error;
    }
  }

  // =============================================================================
  // SELF-FUNDING ALERTS
  // =============================================================================

  /**
   * Create self-funding alert
   * @param alert Alert data to create
   * @returns Created alert
   */
  async createSpotLiveSelfFundingAlert(
    alert: InsertSpotLiveSelfFundingAlert,
  ): Promise<SelectSpotLiveSelfFundingAlert> {
    try {
      const [result] = await this.#db
        .insert(spotLiveSelfFundingAlerts)
        .values(alert)
        .returning();

      if (!result) {
        throw new Error("Failed to create spot live self-funding alert");
      }

      this.#logger.warn(
        `[SpotLiveRepository] Created self-funding alert for agent ${alert.agentId}: ${alert.violationType}, detected=$${alert.detectedValue}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in createSpotLiveSelfFundingAlert");
      throw error;
    }
  }

  /**
   * Batch create multiple self-funding alerts in a single transaction
   * @param alerts Array of alert data to create
   * @returns Array of created alerts
   */
  async batchCreateSpotLiveSelfFundingAlerts(
    alerts: InsertSpotLiveSelfFundingAlert[],
  ): Promise<SelectSpotLiveSelfFundingAlert[]> {
    if (alerts.length === 0) {
      return [];
    }

    try {
      const results = await this.#db
        .insert(spotLiveSelfFundingAlerts)
        .values(alerts)
        .returning();

      for (const alert of results) {
        this.#logger.warn(
          `[SpotLiveRepository] Created self-funding alert for agent ${alert.agentId}: ${alert.violationType}, detected=$${alert.detectedValue}`,
        );
      }

      this.#logger.info(
        `[SpotLiveRepository] Batch created ${results.length} self-funding alerts`,
      );

      return results;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in batchCreateSpotLiveSelfFundingAlerts",
      );
      throw error;
    }
  }

  /**
   * Get unreviewed self-funding alerts for a competition
   * @param competitionId Competition ID
   * @returns Array of unreviewed alerts
   */
  async getUnreviewedSpotLiveAlerts(
    competitionId: string,
  ): Promise<SelectSpotLiveSelfFundingAlert[]> {
    try {
      const alerts = await this.#dbRead
        .select()
        .from(spotLiveSelfFundingAlerts)
        .where(
          and(
            eq(spotLiveSelfFundingAlerts.competitionId, competitionId),
            eq(spotLiveSelfFundingAlerts.reviewed, false),
          ),
        )
        .orderBy(desc(spotLiveSelfFundingAlerts.detectedAt));

      return alerts;
    } catch (error) {
      this.#logger.error({ error }, "Error in getUnreviewedSpotLiveAlerts");
      throw error;
    }
  }

  /**
   * Review a self-funding alert
   * @param alertId Alert ID
   * @param reviewData Review information
   * @returns Updated alert or null
   */
  async reviewSpotLiveSelfFundingAlert(
    alertId: string,
    reviewData: SpotLiveSelfFundingAlertReview,
  ): Promise<SelectSpotLiveSelfFundingAlert | null> {
    try {
      const [result] = await this.#db
        .update(spotLiveSelfFundingAlerts)
        .set(reviewData)
        .where(eq(spotLiveSelfFundingAlerts.id, alertId))
        .returning();

      if (!result) {
        return null;
      }

      this.#logger.info(
        `[SpotLiveRepository] Reviewed self-funding alert ${alertId}: action=${reviewData.actionTaken}`,
      );

      return result;
    } catch (error) {
      this.#logger.error({ error }, "Error in reviewSpotLiveSelfFundingAlert");
      throw error;
    }
  }

  /**
   * Get self-funding alerts for an agent
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @returns Array of alerts
   */
  async getAgentSpotLiveSelfFundingAlerts(
    agentId: string,
    competitionId: string,
  ): Promise<SelectSpotLiveSelfFundingAlert[]> {
    try {
      const alerts = await this.#dbRead
        .select()
        .from(spotLiveSelfFundingAlerts)
        .where(
          and(
            eq(spotLiveSelfFundingAlerts.agentId, agentId),
            eq(spotLiveSelfFundingAlerts.competitionId, competitionId),
          ),
        )
        .orderBy(desc(spotLiveSelfFundingAlerts.detectedAt));

      return alerts;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in getAgentSpotLiveSelfFundingAlerts",
      );
      throw error;
    }
  }

  /**
   * Get the latest transfer block number for an agent in a competition on a specific chain
   * Used to determine incremental sync starting point for transfer history
   *
   * IMPORTANT: The returned block number should be used WITH OVERLAP (not +1) to prevent gaps.
   * Same reasoning as trades - allows retry of failed transfers in the same block.
   * The unique constraint on txHash prevents duplicates during overlapping scans.
   *
   * @param agentId Agent ID
   * @param competitionId Competition ID
   * @param specificChain Specific chain to query
   * @returns Latest block number or null if no transfers exist
   */
  async getLatestSpotLiveTransferBlock(
    agentId: string,
    competitionId: string,
    specificChain: SpecificChain,
  ): Promise<number | null> {
    try {
      const [result] = await this.#dbRead
        .select({ blockNumber: spotLiveTransferHistory.blockNumber })
        .from(spotLiveTransferHistory)
        .where(
          and(
            eq(spotLiveTransferHistory.agentId, agentId),
            eq(spotLiveTransferHistory.competitionId, competitionId),
            eq(spotLiveTransferHistory.specificChain, specificChain),
          ),
        )
        .orderBy(desc(spotLiveTransferHistory.blockNumber))
        .limit(1);

      return result?.blockNumber ?? null;
    } catch (error) {
      this.#logger.error({ error }, "Error in getLatestSpotLiveTransferBlock");
      throw error;
    }
  }

  /**
   * Batch get self-funding alerts for multiple agents
   * @param agentIds Array of agent IDs
   * @param competitionId Competition ID
   * @returns Map of agent ID to their alerts
   */
  async batchGetAgentsSpotLiveSelfFundingAlerts(
    agentIds: string[],
    competitionId: string,
  ): Promise<Map<string, SelectSpotLiveSelfFundingAlert[]>> {
    try {
      const alertsMap = new Map<string, SelectSpotLiveSelfFundingAlert[]>();
      agentIds.forEach((agentId) => {
        alertsMap.set(agentId, []);
      });

      if (agentIds.length === 0) {
        return alertsMap;
      }

      const batchSize = 500;
      const allAlerts: SelectSpotLiveSelfFundingAlert[] = [];

      for (let i = 0; i < agentIds.length; i += batchSize) {
        const batchAgentIds = agentIds.slice(i, i + batchSize);

        const batchAlerts = await this.#dbRead
          .select()
          .from(spotLiveSelfFundingAlerts)
          .where(
            and(
              inArray(spotLiveSelfFundingAlerts.agentId, batchAgentIds),
              eq(spotLiveSelfFundingAlerts.competitionId, competitionId),
            ),
          )
          .orderBy(desc(spotLiveSelfFundingAlerts.detectedAt));

        allAlerts.push(...batchAlerts);
      }

      allAlerts.forEach((alert) => {
        const agentAlerts = alertsMap.get(alert.agentId);
        if (agentAlerts) {
          agentAlerts.push(alert);
        }
      });

      this.#logger.debug(
        `[SpotLiveRepository] Batch fetched alerts for ${agentIds.length} agents in ${Math.ceil(agentIds.length / batchSize)} batches: found ${allAlerts.length} total alerts`,
      );

      return alertsMap;
    } catch (error) {
      this.#logger.error(
        { error },
        "Error in batchGetAgentsSpotLiveSelfFundingAlerts",
      );
      throw error;
    }
  }
}
