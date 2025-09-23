import { randomUUID } from "crypto";
import {
  AnyColumn,
  and,
  asc,
  desc,
  count as drizzleCount,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNotNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { Logger } from "pino";

import {
  competitionAgents,
  competitionRewards,
  competitions,
  competitionsLeaderboard,
} from "../schema/core/defs.js";
// Import for enrichment functionality
import { votes } from "../schema/core/defs.js";
import {
  InsertCompetition,
  InsertCompetitionAgent,
  InsertCompetitionsLeaderboard,
  SelectCompetition,
  SelectCompetitionsLeaderboard,
  UpdateCompetition,
} from "../schema/core/types.js";
import {
  portfolioSnapshots,
  tradingCompetitions,
  tradingCompetitionsLeaderboard,
} from "../schema/trading/defs.js";
import { tradingConstraints } from "../schema/trading/defs.js";
import { InsertTradingCompetition } from "../schema/trading/types.js";
import {
  InsertPortfolioSnapshot,
  SelectPortfolioSnapshot,
} from "../schema/trading/types.js";
import { Database, Transaction } from "../types.js";
import {
  BestPlacementDbSchema,
  CompetitionAgentStatus,
  CompetitionStatus,
  PagingParams,
  SnapshotDbSchema,
  SnapshotSchema,
} from "./types/index.js";
import { getSort } from "./util/query.js";
import { PartialExcept } from "./util/types.js";

/**
 * Competition Repository
 * Handles database operations for competitions
 */

interface Snapshot24hResult {
  earliestSnapshots: Array<{
    id: number;
    agentId: string;
    competitionId: string;
    timestamp: Date;
    totalValue: number;
  }>;
  snapshots24hAgo: Array<{
    id: number;
    agentId: string;
    competitionId: string;
    timestamp: Date;
    totalValue: number;
  }>;
}

// Type for leaderboard entries. Contains the fields stored in the database, enhanced with optional
// PnL data (for trading competitions)
type LeaderboardEntry = InsertCompetitionsLeaderboard & {
  pnl?: number;
  startingValue?: number;
};

const MAX_CACHE_AGE = 1000 * 60 * 5; // 5 minutes

/**
 * allowable order by database columns
 */
const competitionOrderByFields: Record<string, AnyColumn> = {
  id: competitions.id,
  name: competitions.name,
  description: competitions.description,
  externalUrl: competitions.externalUrl,
  imageUrl: competitions.imageUrl,
  startDate: competitions.startDate,
  endDate: competitions.endDate,
  createdAt: competitions.createdAt,
};

export class CompetitionRepository {
  readonly #db: Database;
  readonly #dbRead: Database;
  readonly #logger: Logger;
  readonly #snapshotCache;

  constructor(database: Database, readDatabase: Database, logger: Logger) {
    this.#db = database;
    this.#dbRead = readDatabase;
    this.#logger = logger;
    this.#snapshotCache = new Map<string, [number, Snapshot24hResult]>();
  }

  /**
   * Builds the base competition query with rewards included
   * @returns A query builder for competitions with rewards
   */
  buildCompetitionWithRewardsQuery() {
    return this.#db
      .select({
        crossChainTradingType: tradingCompetitions.crossChainTradingType,
        rewards: sql<
          | Array<{ rank: number; reward: number; agentId: string | null }>
          | undefined
        >`
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'rank', cr.rank,
                'reward', cr.reward,
                'agentId', cr.agent_id
              ) ORDER BY cr.rank
            ),
            NULL
          )
          FROM ${competitionRewards} cr
          WHERE cr.competition_id = ${competitions.id}
        )
      `.as("rewards"),
        ...getTableColumns(competitions),
      })
      .from(tradingCompetitions)
      .innerJoin(
        competitions,
        eq(tradingCompetitions.competitionId, competitions.id),
      );
  }

  /**
   * Find all competitions
   */
  async findAll() {
    return await this.#db
      .select({
        crossChainTradingType: tradingCompetitions.crossChainTradingType,
        ...getTableColumns(competitions),
      })
      .from(tradingCompetitions)
      .innerJoin(
        competitions,
        eq(tradingCompetitions.competitionId, competitions.id),
      );
  }

  /**
   * Find a competition by ID
   * @param id The ID to search for
   */
  async findById(id: string) {
    const [result] = await this.#db
      .select({
        crossChainTradingType: tradingCompetitions.crossChainTradingType,
        ...getTableColumns(competitions),
      })
      .from(tradingCompetitions)
      .innerJoin(
        competitions,
        eq(tradingCompetitions.competitionId, competitions.id),
      )
      .where(eq(competitions.id, id))
      .limit(1);
    return result;
  }

  /**
   * Create a new competition
   * @param competition Competition to create
   * @param tx Optional database transaction
   */
  async create(
    competition: InsertCompetition &
      Omit<InsertTradingCompetition, "competitionId">,
    tx?: Transaction,
  ) {
    const executor = tx || this.#db;
    const result = await executor.transaction(async (tx) => {
      const now = new Date();
      const [comp] = await tx
        .insert(competitions)
        .values({
          ...competition,
          createdAt: competition.createdAt || now,
          updatedAt: competition.updatedAt || now,
        })
        .returning();
      const [tradingComp] = await tx
        .insert(tradingCompetitions)
        .values({
          competitionId: comp!.id,
          crossChainTradingType: competition.crossChainTradingType,
        })
        .returning();
      return { ...comp!, ...tradingComp! };
    });
    return result;
  }

  /**
   * Update an existing competition and trading_competition in a transaction
   * @param competition Competition to update
   */
  async update(
    competition: PartialExcept<InsertCompetition, "id"> &
      Partial<Omit<InsertTradingCompetition, "competitionId">>,
  ) {
    try {
      const result = await this.#db.transaction(async (tx) => {
        const [comp] = await tx
          .update(competitions)
          .set({
            ...competition,
            updatedAt: competition.updatedAt || new Date(),
          })
          .where(eq(competitions.id, competition.id))
          .returning();

        // Only update `trading_competitions` if we have relevant updates
        let tradingComp:
          | Partial<Omit<InsertTradingCompetition, "competitionId">>
          | undefined;
        const tradingCompetitionFields = {
          crossChainTradingType: competition.crossChainTradingType,
        };
        const hasTradingCompetitionUpdates = Object.values(
          tradingCompetitionFields,
        ).some((value) => value !== undefined);

        if (hasTradingCompetitionUpdates) {
          // Use the `returning` to get the updated competition
          [tradingComp] = await tx
            .update(tradingCompetitions)
            .set(tradingCompetitionFields)
            .where(eq(tradingCompetitions.competitionId, competition.id))
            .returning();
        } else {
          // Fetch current trading competition data if no updates needed
          [tradingComp] = await tx
            .select()
            .from(tradingCompetitions)
            .where(eq(tradingCompetitions.competitionId, competition.id))
            .limit(1);
        }

        return { ...comp, ...tradingComp };
      });
      return result;
    } catch (error) {
      this.#logger.error("Error in update:", error);
      throw error;
    }
  }

  /**
   * Update a single competition by ID
   * @param competitionId Competition ID
   * @param updateData Update data for the competition
   * @param tx Optional database transaction
   * @returns Updated competition record
   */
  async updateOne(
    competitionId: string,
    updateData: UpdateCompetition,
    tx?: Transaction,
  ): Promise<SelectCompetition> {
    try {
      const executor = tx || this.#db;
      const [result] = await executor
        .update(competitions)
        .set({
          ...updateData,
          updatedAt: updateData.updatedAt || new Date(),
        })
        .where(eq(competitions.id, competitionId))
        .returning();

      if (!result) {
        throw new Error(`Competition with ID ${competitionId} not found`);
      }

      return result;
    } catch (error) {
      this.#logger.error("Error in updateOne:", error);
      throw error;
    }
  }

  /**
   * Mark competition as ending (active -> ending)
   * This is used to claim a competition for ending processing
   * @param competitionId Competition ID
   * @returns The competition if successfully marked as ending, null otherwise
   */
  async markCompetitionAsEnding(
    competitionId: string,
  ): Promise<SelectCompetition | null> {
    try {
      const [updated] = await this.#db
        .update(competitions)
        .set({
          status: "ending" as const,
          endDate: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(competitions.id, competitionId),
            eq(competitions.status, "active"),
          ),
        )
        .returning();

      return updated || null;
    } catch (error) {
      this.#logger.error("Error marking competition as ending:", error);
      throw error;
    }
  }

  /**
   * Mark competition as ended (ending -> ended) within a transaction
   * This acts as a guard to ensure only one process can finalize a competition
   * @param competitionId Competition ID
   * @param tx Optional database transaction
   * @returns The competition if successfully marked as ended, null otherwise
   */
  async markCompetitionAsEnded(
    competitionId: string,
    tx?: Transaction,
  ): Promise<SelectCompetition | null> {
    const executor = tx || this.#db;

    try {
      const [updated] = await executor
        .update(competitions)
        .set({
          status: "ended" as const,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(competitions.id, competitionId),
            eq(competitions.status, "ending"),
          ),
        )
        .returning();

      return updated || null;
    } catch (error) {
      this.#logger.error("Error marking competition as ended:", error);
      throw error;
    }
  }

  /**
   * Atomically add an agent to a competition with participant limit validation
   * This checks the participant limit and adds the agent in a single transaction
   * to prevent race conditions when multiple agents try to join simultaneously.
   *
   * @param competitionId Competition ID
   * @param agentId Agent ID to add
   * @throws Error if participant limit would be exceeded
   */
  async addAgentToCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<void> {
    try {
      await this.#db.transaction(async (tx) => {
        // Get competition details including maxParticipants and current registeredParticipants
        const [competition] = await tx
          .select({
            maxParticipants: competitions.maxParticipants,
            registeredParticipants: competitions.registeredParticipants,
          })
          .from(competitions)
          .where(eq(competitions.id, competitionId))
          .for("update");

        if (!competition) {
          throw new Error(`Competition ${competitionId} not found`);
        }

        // Attempt to add the agent to the competition
        const insertResult = await tx
          .insert(competitionAgents)
          .values({
            competitionId,
            agentId,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing()
          .returning({ insertedId: competitionAgents.agentId });

        // Only process if the agent was actually inserted (not a duplicate)
        if (insertResult.length > 0) {
          // Check participant limit AFTER confirming this is a new registration
          if (
            competition.maxParticipants &&
            competition.registeredParticipants + 1 > competition.maxParticipants
          ) {
            // Transaction will rollback, keeping registeredParticipants accurate
            throw new Error(
              `Competition has reached maximum participant limit (${competition.maxParticipants})`,
            );
          }

          // Increment the participant counter
          await tx
            .update(competitions)
            .set({
              registeredParticipants: sql`${competitions.registeredParticipants} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(competitions.id, competitionId));
        }
      });
    } catch (error) {
      this.#logger.error(
        `Error adding agent ${agentId} to competition ${competitionId} with limit check:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Remove an agent from a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID to remove
   * @returns Boolean indicating if a row was deleted
   */
  async removeAgentFromCompetition(
    competitionId: string,
    agentId: string,
    reason?: string,
  ): Promise<boolean> {
    try {
      await this.#db.transaction(async (tx) => {
        // Remove/disqualify the agent from the competition
        const result = await tx
          .update(competitionAgents)
          .set({
            status: "disqualified",
            deactivationReason: reason || "Disqualified from competition",
            deactivatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(competitionAgents.competitionId, competitionId),
              eq(competitionAgents.agentId, agentId),
              eq(competitionAgents.status, "active"),
            ),
          )
          .returning();

        if (result.length === 0) {
          this.#logger.debug(
            `No active agent ${agentId} found in competition ${competitionId} to remove`,
          );
          throw new Error(
            `Agent ${agentId} was not removed from competition ${competitionId}`,
          );
        }

        // If an agent was actually removed, decrement the registeredParticipants counter
        await tx
          .update(competitions)
          .set({
            registeredParticipants: sql`${competitions.registeredParticipants} - 1`,
            updatedAt: new Date(),
          })
          .where(eq(competitions.id, competitionId));
        this.#logger.debug(
          `Removed agent ${agentId} from competition ${competitionId}`,
        );
      });

      return true;
    } catch (error) {
      this.#logger.error(
        `Error removing agent ${agentId} from competition ${competitionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Add agents to a competition (bulk operation)
   * @param competitionId Competition ID
   * @param agentIds Array of agent IDs
   */
  async addAgents(competitionId: string, agentIds: string[]) {
    if (agentIds.length === 0) {
      return;
    }

    try {
      await this.#db.transaction(async (tx) => {
        // Get current competition details with row lock
        const [competition] = await tx
          .select({
            maxParticipants: competitions.maxParticipants,
            registeredParticipants: competitions.registeredParticipants,
          })
          .from(competitions)
          .where(eq(competitions.id, competitionId))
          .for("update");

        if (!competition) {
          throw new Error(`Competition ${competitionId} not found`);
        }

        // Check if adding these agents would exceed the limit
        if (competition.maxParticipants) {
          const potentialTotal =
            competition.registeredParticipants + agentIds.length;
          if (potentialTotal > competition.maxParticipants) {
            throw new Error(
              `Adding ${agentIds.length} agents would exceed the maximum participant limit (${competition.maxParticipants})`,
            );
          }
        }

        const now = new Date();
        const values: InsertCompetitionAgent[] = agentIds.map((agentId) => ({
          competitionId,
          agentId,
          status: "active",
          createdAt: now,
          updatedAt: now,
        }));

        // Insert agents and get the count of actually inserted rows
        const insertResult = await tx
          .insert(competitionAgents)
          .values(values)
          .onConflictDoNothing()
          .returning({ insertedId: competitionAgents.agentId });

        const insertedCount = insertResult.length;

        // Update the registered participants count based on actual insertions
        if (insertedCount > 0) {
          await tx
            .update(competitions)
            .set({
              registeredParticipants: sql`${competitions.registeredParticipants} + ${insertedCount}`,
              updatedAt: new Date(),
            })
            .where(eq(competitions.id, competitionId));
        }

        this.#logger.debug(
          `Added ${insertedCount} out of ${agentIds.length} agents to competition ${competitionId}`,
        );
      });
    } catch (error) {
      this.#logger.error("Error in addAgents:", error);
      throw error;
    }
  }

  /**
   * Get agents in a competition
   * @param competitionId Competition ID
   * @param status Optional status filter - defaults to active only
   * @param tx Optional database transaction
   */
  async getAgents(
    competitionId: string,
    status: CompetitionAgentStatus = "active",
    tx?: Transaction,
  ): Promise<string[]> {
    const executor = tx || this.#db;

    try {
      const result = await executor
        .select({ agentId: competitionAgents.agentId })
        .from(competitionAgents)
        .where(
          and(
            eq(competitionAgents.competitionId, competitionId),
            eq(competitionAgents.status, status),
          ),
        );

      return result.map((row) => row.agentId);
    } catch (error) {
      this.#logger.error("Error in getAgents:", error);
      throw error;
    }
  }

  /**
   * Alias for getAgents for better semantic naming
   * @param competitionId Competition ID
   * @param status Optional status filter - defaults to active only
   * @param tx Optional database transaction
   */
  async getCompetitionAgents(
    competitionId: string,
    status?: CompetitionAgentStatus,
    tx?: Transaction,
  ) {
    return this.getAgents(competitionId, status, tx);
  }

  /**
   * Check if an agent is actively participating in a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns boolean indicating if agent is active in the competition
   */
  async isAgentActiveInCompetition(
    competitionId: string,
    agentId: string,
  ): Promise<boolean> {
    try {
      const result = await this.#db
        .select({ agentId: competitionAgents.agentId })
        .from(competitionAgents)
        .where(
          and(
            eq(competitionAgents.competitionId, competitionId),
            eq(competitionAgents.agentId, agentId),
            eq(competitionAgents.status, "active"),
          ),
        )
        .limit(1);

      return result.length > 0;
    } catch (error) {
      this.#logger.error("Error in isAgentActiveInCompetition:", error);
      throw error;
    }
  }

  /**
   * Get the status of an agent in a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns The agent's status in the competition, or null if not found
   */
  async getAgentCompetitionStatus(
    competitionId: string,
    agentId: string,
  ): Promise<CompetitionAgentStatus | null> {
    try {
      const result = await this.#db
        .select({ status: competitionAgents.status })
        .from(competitionAgents)
        .where(
          and(
            eq(competitionAgents.competitionId, competitionId),
            eq(competitionAgents.agentId, agentId),
          ),
        )
        .limit(1);

      return result.length > 0 ? result[0]!.status : null;
    } catch (error) {
      this.#logger.error("Error in getAgentCompetitionStatus:", error);
      throw error;
    }
  }

  /**
   * Get an agent's competition record with full details
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns The agent's competition record or null if not found
   */
  async getAgentCompetitionRecord(
    competitionId: string,
    agentId: string,
  ): Promise<{
    status: CompetitionAgentStatus;
    deactivationReason: string | null;
    deactivatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      const result = await this.#db
        .select({
          status: competitionAgents.status,
          deactivationReason: competitionAgents.deactivationReason,
          deactivatedAt: competitionAgents.deactivatedAt,
          createdAt: competitionAgents.createdAt,
          updatedAt: competitionAgents.updatedAt,
        })
        .from(competitionAgents)
        .where(
          and(
            eq(competitionAgents.competitionId, competitionId),
            eq(competitionAgents.agentId, agentId),
          ),
        )
        .limit(1);

      return result.length > 0 ? result[0]! : null;
    } catch (error) {
      this.#logger.error("Error in getAgentCompetitionRecord:", error);
      throw error;
    }
  }

  /**
   * Get competition records for multiple agents efficiently
   * This replaces N calls to getAgentCompetitionRecord with a single bulk operation
   * @param competitionId Competition ID
   * @param agentIds Array of agent IDs to get records for
   * @returns Array of agent competition records
   */
  async getBulkAgentCompetitionRecords(
    competitionId: string,
    agentIds: string[],
  ): Promise<
    Array<{
      agentId: string;
      status: CompetitionAgentStatus;
      deactivationReason: string | null;
      deactivatedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    if (agentIds.length === 0) {
      return [];
    }

    try {
      this.#logger.debug(
        `getBulkAgentCompetitionRecords called for ${agentIds.length} agents in competition ${competitionId}`,
      );

      const result = await this.#db
        .select({
          agentId: competitionAgents.agentId,
          status: competitionAgents.status,
          deactivationReason: competitionAgents.deactivationReason,
          deactivatedAt: competitionAgents.deactivatedAt,
          createdAt: competitionAgents.createdAt,
          updatedAt: competitionAgents.updatedAt,
        })
        .from(competitionAgents)
        .where(
          and(
            eq(competitionAgents.competitionId, competitionId),
            inArray(competitionAgents.agentId, agentIds),
          ),
        );

      this.#logger.debug(
        `Retrieved ${result.length} competition records for ${agentIds.length} agents`,
      );

      return result;
    } catch (error) {
      this.#logger.error("Error in getBulkAgentCompetitionRecords:", error);
      throw error;
    }
  }

  /**
   * Update an agent's status in a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @param status New status
   * @param reason Optional reason for the status change
   * @returns boolean indicating if the update was successful
   */
  async updateAgentCompetitionStatus(
    competitionId: string,
    agentId: string,
    status: CompetitionAgentStatus,
    reason?: string,
  ): Promise<boolean> {
    try {
      let wasUpdated = false;

      await this.#db.transaction(async (tx) => {
        // First get the current status
        const [currentStatus] = await tx
          .select({ status: competitionAgents.status })
          .from(competitionAgents)
          .where(
            and(
              eq(competitionAgents.competitionId, competitionId),
              eq(competitionAgents.agentId, agentId),
            ),
          );

        if (!currentStatus) {
          return; // Agent not found in competition
        }

        // Only proceed if status is actually changing
        if (currentStatus.status === status) {
          return; // No change needed
        }

        const baseUpdateData = {
          status,
          updatedAt: new Date(),
        };

        // Add deactivation fields when moving to inactive status, clear them when reactivating
        const updateData =
          status !== "active"
            ? {
                ...baseUpdateData,
                deactivationReason: reason || `Status changed to ${status}`,
                deactivatedAt: new Date(),
              }
            : {
                ...baseUpdateData,
                deactivationReason: null,
                deactivatedAt: null,
              };

        const result = await tx
          .update(competitionAgents)
          .set(updateData)
          .where(
            and(
              eq(competitionAgents.competitionId, competitionId),
              eq(competitionAgents.agentId, agentId),
            ),
          )
          .returning();

        wasUpdated = result.length > 0;

        // Update the registered participants counter if the status change affects it
        if (wasUpdated) {
          const wasActive = currentStatus.status === "active";
          const isNowActive = status === "active";

          if (wasActive && !isNowActive) {
            // Decrement counter: ACTIVE -> non-ACTIVE
            const [competition] = await tx
              .select({
                registeredParticipants: competitions.registeredParticipants,
              })
              .from(competitions)
              .where(eq(competitions.id, competitionId));

            if (competition && competition.registeredParticipants > 0) {
              await tx
                .update(competitions)
                .set({
                  registeredParticipants: sql`${competitions.registeredParticipants} - 1`,
                  updatedAt: new Date(),
                })
                .where(eq(competitions.id, competitionId));
            }
          } else if (!wasActive && isNowActive) {
            // Increment counter: non-ACTIVE -> ACTIVE
            const [competition] = await tx
              .select({
                maxParticipants: competitions.maxParticipants,
                registeredParticipants: competitions.registeredParticipants,
              })
              .from(competitions)
              .where(eq(competitions.id, competitionId));

            if (competition) {
              // Check participant limit before reactivating
              if (
                competition.maxParticipants &&
                competition.registeredParticipants >=
                  competition.maxParticipants
              ) {
                throw new Error(
                  `Cannot reactivate agent: Competition has reached maximum participant limit (${competition.maxParticipants})`,
                );
              }

              await tx
                .update(competitions)
                .set({
                  registeredParticipants: sql`${competitions.registeredParticipants} + 1`,
                  updatedAt: new Date(),
                })
                .where(eq(competitions.id, competitionId));
            }
          }
        }
      });

      if (wasUpdated) {
        this.#logger.debug(
          `Updated agent ${agentId} status to ${status} in competition ${competitionId}`,
        );
      }

      return wasUpdated;
    } catch (error) {
      this.#logger.error("Error in updateAgentCompetitionStatus:", error);
      throw error;
    }
  }

  /**
   * Mark an agent as having left a competition voluntarily
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @param reason Optional reason for leaving
   * @returns boolean indicating if the update was successful
   */
  async markAgentAsWithdrawn(
    competitionId: string,
    agentId: string,
    reason?: string,
  ): Promise<boolean> {
    return this.updateAgentCompetitionStatus(
      competitionId,
      agentId,
      "withdrawn",
      reason || "Agent withdrew from competition voluntarily",
    );
  }

  /**
   * Find active competition
   */
  async findActive() {
    try {
      const [result] = await this.#db
        .select({
          crossChainTradingType: tradingCompetitions.crossChainTradingType,
          ...getTableColumns(competitions),
        })
        .from(tradingCompetitions)
        .innerJoin(
          competitions,
          eq(tradingCompetitions.competitionId, competitions.id),
        )
        .where(eq(competitions.status, "active"))
        .limit(1);

      return result;
    } catch (error) {
      this.#logger.error("Error in findActive:", error);
      throw error;
    }
  }

  async findVotingOpen(tx?: Transaction) {
    try {
      const now = new Date();
      const executor = tx || this.#db;
      const result = await executor
        .select()
        .from(competitions)
        .where(
          and(
            lt(competitions.votingStartDate, now),
            gt(competitions.votingEndDate, now),
          ),
        );
      return result;
    } catch (error) {
      this.#logger.error("Error in findVotingOpen:", error);
      throw error;
    }
  }

  /**
   * Create a portfolio snapshot
   * @param snapshot Portfolio snapshot data
   */
  async createPortfolioSnapshot(snapshot: InsertPortfolioSnapshot) {
    try {
      const [result] = await this.#db
        .insert(portfolioSnapshots)
        .values({
          ...snapshot,
          timestamp: snapshot.timestamp || new Date(),
        })
        .returning();

      if (!result) {
        throw new Error(
          "Failed to create portfolio snapshot - no result returned",
        );
      }

      return result;
    } catch (error) {
      this.#logger.error("Error in createPortfolioSnapshot:", error);
      throw error;
    }
  }

  /**
   * Get latest portfolio snapshots for all active agents in a competition
   * @param competitionId Competition ID
   */
  async getLatestPortfolioSnapshots(
    competitionId: string,
  ): Promise<SelectPortfolioSnapshot[]> {
    try {
      const result = await this.#dbRead.execute<{
        id: number;
        agent_id: string;
        competition_id: string;
        timestamp: Date;
        total_value: number;
      }>(sql`
      SELECT ps.id, ps.agent_id, ps.competition_id, ps.timestamp, ps.total_value
      FROM ${competitionAgents} ca
      CROSS JOIN LATERAL (
        SELECT ps.id, ps.agent_id, ps.competition_id, ps.timestamp, ps.total_value
        FROM ${portfolioSnapshots} ps
        WHERE ps.agent_id = ca.agent_id
          AND ps.competition_id = ca.competition_id
        ORDER BY ps.timestamp DESC
        LIMIT 1
      ) ps
      WHERE ca.competition_id = ${competitionId}
        AND ca.status = ${"active"}
    `);

      // Convert snake_case to camelCase to match Drizzle `SelectPortfolioSnapshot` type
      return result.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        competitionId: row.competition_id,
        timestamp: row.timestamp,
        totalValue: Number(row.total_value), // Convert string to number for numeric fields
      }));
    } catch (error) {
      this.#logger.error("Error in getLatestPortfolioSnapshots:", error);
      throw error;
    }
  }

  /**
   * Get the latest portfolio snapshot for multiple agents in a competition efficiently
   * @param competitionId Competition ID
   * @param agentIds Array of agent IDs to get latest snapshots for
   * @returns Array containing only the most recent portfolio snapshot for each agent
   */
  async getBulkLatestPortfolioSnapshots(
    competitionId: string,
    agentIds: string[],
  ): Promise<SelectPortfolioSnapshot[]> {
    if (agentIds.length === 0) {
      return [];
    }

    try {
      this.#logger.debug(
        `getBulkLatestPortfolioSnapshots called for ${agentIds.length} agents in competition ${competitionId}`,
      );

      // Build the SQL query using LATERAL join to get only the latest snapshot per agent
      const result = await this.#dbRead.execute<{
        id: number;
        agent_id: string;
        competition_id: string;
        timestamp: Date;
        total_value: number;
      }>(sql`
      SELECT ps.id, ps.agent_id, ps.competition_id, ps.timestamp, ps.total_value
      FROM (SELECT UNNEST(${sql`ARRAY[${sql.raw(agentIds.map((id) => `'${id}'`).join(", "))}]::uuid[]`}) as agent_id) agents
      CROSS JOIN LATERAL (
        SELECT id, agent_id, competition_id, timestamp, total_value
        FROM ${portfolioSnapshots} ps
        WHERE ps.agent_id = agents.agent_id
          AND ps.competition_id = ${competitionId}
        ORDER BY ps.timestamp DESC
        LIMIT 1
      ) ps
    `);

      this.#logger.debug(
        `Retrieved ${result.rows.length} latest portfolio snapshots for ${agentIds.length} agents`,
      );

      // Convert snake_case to camelCase to match Drizzle SelectPortfolioSnapshot type
      return result.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        competitionId: row.competition_id,
        timestamp: row.timestamp,
        totalValue: Number(row.total_value),
      }));
    } catch (error) {
      this.#logger.error("Error in getBulkLatestPortfolioSnapshots:", error);
      throw error;
    }
  }

  /**
   * Get earliest and 24h-ago snapshots for each agent
   * @param competitionId Competition ID
   * @param agentIds Array of agent IDs to get snapshots for
   * @returns Object containing earliest and 24h-ago snapshots by agent
   */
  async get24hSnapshots(
    competitionId: string,
    agentIds: string[],
  ): Promise<Snapshot24hResult> {
    if (agentIds.length === 0) {
      return { earliestSnapshots: [], snapshots24hAgo: [] };
    }

    this.#logger.debug(
      `get24hSnapshots called for ${agentIds.length} agents in competition ${competitionId}`,
    );

    const cacheKey = `${competitionId}-${agentIds.join("-")}`;
    const cachedResult = this.#snapshotCache.get(cacheKey);
    if (cachedResult) {
      const now = Date.now();
      const [timestamp, result] = cachedResult;
      if (now - timestamp < MAX_CACHE_AGE) {
        this.#logger.debug(`get24hSnapshots returning cached results`);
        return result;
      }
    }

    try {
      const comp = await this.#dbRead
        .select({ endDate: competitions.endDate })
        .from(competitions)
        .where(
          and(
            eq(competitions.status, "ended"),
            eq(competitions.id, competitionId),
          ),
        );
      const endDate = comp[0]?.endDate;
      const endTime = endDate ? endDate.valueOf() : Date.now();
      const twentyFourHoursAgo = new Date(endTime - 24 * 60 * 60 * 1000);

      // Get earliest snapshots for each agent using efficient UNNEST + CROSS JOIN LATERAL
      let earliestResult;
      try {
        earliestResult = await this.#dbRead.execute<{
          id: number;
          agent_id: string;
          competition_id: string;
          timestamp: Date;
          total_value: string;
        }>(sql`
        SELECT ps.id, ps.agent_id, ps.competition_id, ps.timestamp, ps.total_value
        FROM (SELECT UNNEST(${sql`ARRAY[${sql.raw(agentIds.map((id) => `'${id}'`).join(", "))}]::uuid[]`}) as agent_id) agents
        CROSS JOIN LATERAL (
          SELECT id, agent_id, competition_id, timestamp, total_value
          FROM trading_comps.portfolio_snapshots ps
          WHERE ps.agent_id = agents.agent_id
            AND ps.competition_id = ${competitionId}
          ORDER BY ps.timestamp ASC
          LIMIT 1
        ) ps
      `);
      } catch (error) {
        this.#logger.error("Error executing earliestResult query:", error);
        throw new Error(
          `Failed to get earliest snapshots: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      // Get snapshots closest to 24h ago using efficient UNNEST + CROSS JOIN LATERAL
      let snapshots24hResult;
      try {
        snapshots24hResult = await this.#dbRead.execute<{
          id: number;
          agent_id: string;
          competition_id: string;
          timestamp: Date;
          total_value: string;
        }>(sql`
        SELECT ps.id, ps.agent_id, ps.competition_id, ps.timestamp, ps.total_value
        FROM (SELECT UNNEST(${sql`ARRAY[${sql.raw(agentIds.map((id) => `'${id}'`).join(", "))}]::uuid[]`}) as agent_id) agents
        CROSS JOIN LATERAL (
          SELECT id, agent_id, competition_id, timestamp, total_value
          FROM trading_comps.portfolio_snapshots ps
          WHERE ps.agent_id = agents.agent_id
            AND ps.competition_id = ${competitionId}
          ORDER BY ABS(EXTRACT(EPOCH FROM ps.timestamp - ${twentyFourHoursAgo}))
          LIMIT 1
        ) ps
      `);
      } catch (error) {
        this.#logger.error("Error executing snapshots24hResult query:", error);
        throw new Error(
          `Failed to get 24h snapshots: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      if (!earliestResult || !earliestResult.rows) {
        this.#logger.error(
          `earliestResult is undefined or missing rows property: ${JSON.stringify(earliestResult)}`,
        );
        throw new Error("earliestResult is undefined or missing rows property");
      }
      if (!snapshots24hResult || !snapshots24hResult.rows) {
        this.#logger.error(
          `snapshots24hResult is undefined or missing rows property: ${JSON.stringify(snapshots24hResult)}`,
        );
        throw new Error(
          "snapshots24hResult is undefined or missing rows property",
        );
      }

      this.#logger.debug(
        `Retrieved ${earliestResult.rows.length} earliest snapshots and ${snapshots24hResult.rows.length} 24h-ago snapshots for ${agentIds.length} agents`,
      );

      const result: Snapshot24hResult = {
        earliestSnapshots: earliestResult.rows.map((row) => ({
          id: row.id,
          agentId: row.agent_id,
          competitionId: row.competition_id,
          timestamp: row.timestamp && new Date(row.timestamp),
          totalValue: Number(row.total_value),
        })),
        snapshots24hAgo: snapshots24hResult.rows.map((row) => ({
          id: row.id,
          agentId: row.agent_id,
          competitionId: row.competition_id,
          timestamp: row.timestamp && new Date(row.timestamp),
          totalValue: Number(row.total_value),
        })),
      };

      // Cache the result
      const now = Date.now();
      this.#snapshotCache.set(cacheKey, [now, result]);
      return result;
    } catch (error) {
      this.#logger.error("Error in get24hSnapshots:", error);
      throw error;
    }
  }

  /**
   * Get portfolio snapshots for an agent in a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @param limit Optional limit for the number of snapshots to return
   */
  async getAgentPortfolioSnapshots(
    competitionId: string,
    agentId: string,
    limit?: number,
  ) {
    try {
      const query = this.#db
        .select()
        .from(portfolioSnapshots)
        .where(
          and(
            eq(portfolioSnapshots.competitionId, competitionId),
            eq(portfolioSnapshots.agentId, agentId),
          ),
        )
        .orderBy(desc(portfolioSnapshots.timestamp));

      // Apply limit if specified
      if (limit !== undefined && limit > 0) {
        return await query.limit(limit);
      }

      return await query;
    } catch (error) {
      this.#logger.error("Error in getAgentPortfolioSnapshots:", error);
      throw error;
    }
  }

  /**
   * Get the newest and oldest portfolio snapshots for an agent in a competition
   * @param competitionId Competition ID
   * @param agentId Agent ID
   * @returns Object with newest and oldest snapshots, or null if no snapshots found
   */
  async getBoundedSnapshots(competitionId: string, agentId: string) {
    try {
      // Create subqueries for newest and oldest snapshots
      const newestQuery = this.#db
        .select()
        .from(portfolioSnapshots)
        .where(
          and(
            eq(portfolioSnapshots.competitionId, competitionId),
            eq(portfolioSnapshots.agentId, agentId),
          ),
        )
        .orderBy(desc(portfolioSnapshots.timestamp))
        .limit(1);

      const oldestQuery = this.#db
        .select()
        .from(portfolioSnapshots)
        .where(
          and(
            eq(portfolioSnapshots.competitionId, competitionId),
            eq(portfolioSnapshots.agentId, agentId),
          ),
        )
        .orderBy(asc(portfolioSnapshots.timestamp))
        .limit(1);

      // Union the queries and execute
      const results = await unionAll(newestQuery, oldestQuery);

      if (results.length === 0) {
        return null;
      }

      // Sort results by timestamp desc to identify newest vs oldest
      const sortedResults = results.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return {
        newest: sortedResults[0],
        oldest: sortedResults[sortedResults.length - 1],
      };
    } catch (error) {
      this.#logger.error("Error in getAgentPortfolioSnapshotBounds:", error);
      throw error;
    }
  }

  /**
   * Get bounded snapshots for an agent across multiple competitions in bulk
   * @param agentId Agent ID
   * @param competitionIds Array of competition IDs
   * @returns Map of competition ID to bounded snapshots
   */
  async getBulkBoundedSnapshots(
    agentId: string,
    competitionIds: string[],
  ): Promise<
    Map<
      string,
      {
        newest: typeof portfolioSnapshots.$inferSelect;
        oldest: typeof portfolioSnapshots.$inferSelect;
      } | null
    >
  > {
    if (competitionIds.length === 0) {
      return new Map();
    }

    try {
      this.#logger.debug(
        `getBulkBoundedSnapshots called for agent ${agentId} in ${competitionIds.length} competitions`,
      );

      // Get only newest and oldest snapshots for each competition using window functions
      const snapshotResults = await this.#db.execute(
        sql`
        WITH ranked_snapshots AS (
          SELECT *,
            ROW_NUMBER() OVER (PARTITION BY competition_id ORDER BY timestamp DESC) as rn_desc,
            ROW_NUMBER() OVER (PARTITION BY competition_id ORDER BY timestamp ASC) as rn_asc
          FROM ${portfolioSnapshots}
          WHERE agent_id = ${agentId}
            AND competition_id IN (${sql.join(
              competitionIds.map((id) => sql`${id}`),
              sql`, `,
            )})
        )
        SELECT id, competition_id, agent_id, timestamp, total_value
        FROM ranked_snapshots
        WHERE rn_desc = 1 OR rn_asc = 1
      `,
      );

      // Convert raw results to typed snapshots with lowerCamelCase
      const allSnapshots = snapshotResults.rows
        .map(function (row) {
          const { data, success, error } = SnapshotDbSchema.safeParse(row);
          if (!success) {
            throw new Error(`snapshotResults.rows.map: ${error}`);
          }
          return {
            id: data.id,
            competitionId: data.competition_id,
            agentId: data.agent_id,
            timestamp: data.timestamp,
            totalValue: data.total_value,
          };
        })
        .filter((r) => r);

      // Group snapshots by competition and find newest/oldest for each
      const snapshotMap = new Map<
        string,
        {
          newest: typeof portfolioSnapshots.$inferSelect;
          oldest: typeof portfolioSnapshots.$inferSelect;
        } | null
      >();

      // Initialize map with null for all competitions
      for (const competitionId of competitionIds) {
        snapshotMap.set(competitionId, null);
      }

      // Group snapshots by competition
      const snapshotsByCompetition = new Map<
        string,
        (typeof portfolioSnapshots.$inferSelect)[]
      >();

      for (const snapshot of allSnapshots) {
        const { data, success, error } = SnapshotSchema.safeParse(snapshot);
        if (!success) {
          throw new Error(`allSnapshots: ${error}`);
        }

        const compSnapshots =
          snapshotsByCompetition.get(data.competitionId) || [];
        compSnapshots.push(data);
        snapshotsByCompetition.set(data.competitionId, compSnapshots);
      }

      // Find newest and oldest for each competition
      for (const [competitionId, snapshots] of snapshotsByCompetition) {
        if (snapshots.length > 0) {
          // Sort by timestamp
          const sorted = snapshots.sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );

          snapshotMap.set(competitionId, {
            newest: sorted[0]!,
            oldest: sorted[sorted.length - 1]!,
          });
        }
      }

      this.#logger.debug(
        `Found snapshots for ${snapshotsByCompetition.size}/${competitionIds.length} competitions`,
      );

      return snapshotMap;
    } catch (error) {
      this.#logger.error("Error in getBulkBoundedSnapshots:", error);
      throw error;
    }
  }

  /**
   * Get rankings for a single agent across multiple competitions
   * @param agentId Agent ID
   * @param competitionIds Array of competition IDs
   * @returns Map of competition ID to ranking data
   */
  async getAgentRankingsInCompetitions(
    agentId: string,
    competitionIds: string[],
  ): Promise<Map<string, { rank: number; totalAgents: number } | undefined>> {
    if (competitionIds.length === 0) {
      return new Map();
    }

    try {
      this.#logger.debug(
        `getAgentRankingsInCompetitions called for agent ${agentId} in ${competitionIds.length} competitions`,
      );

      // Calculate rankings directly in SQL without fetching all agents
      // Only include active agents in ranking calculation
      const rankingResults = await this.#db.execute(
        sql`
        WITH latest_snapshots AS (
          SELECT
            ps.competition_id,
            ps.agent_id,
            ps.total_value,
            ROW_NUMBER() OVER (PARTITION BY ps.competition_id, ps.agent_id ORDER BY ps.timestamp DESC) as rn
          FROM ${portfolioSnapshots} ps
          INNER JOIN ${competitionAgents} ca ON ps.agent_id = ca.agent_id AND ps.competition_id = ca.competition_id
          WHERE ps.competition_id IN (${sql.join(
            competitionIds.map((id) => sql`${id}`),
            sql`, `,
          )})
            AND ca.status = ${"active"}
        ),
        ranked AS (
          SELECT
            competition_id,
            agent_id,
            total_value,
            RANK() OVER (PARTITION BY competition_id ORDER BY total_value DESC) as rank,
            COUNT(*) OVER (PARTITION BY competition_id) as total_agents
          FROM latest_snapshots
          WHERE rn = 1
        )
        SELECT
          competition_id,
          rank,
          total_agents
        FROM ranked
        WHERE agent_id = ${agentId}
      `,
      );

      // Convert results to map
      const rankingsMap = new Map<
        string,
        { rank: number; totalAgents: number } | undefined
      >();

      // Initialize all competitions with undefined
      for (const competitionId of competitionIds) {
        rankingsMap.set(competitionId, undefined);
      }

      // Update with actual rankings
      for (const row of rankingResults.rows) {
        const { data, success, error } = BestPlacementDbSchema.safeParse(row);
        if (success !== true) {
          throw new Error(`${error}`);
        }

        rankingsMap.set(data.competition_id, {
          rank: data.rank,
          totalAgents: data.total_agents,
        });
      }

      this.#logger.debug(
        `Found rankings for ${Array.from(rankingsMap.values()).filter((r) => r).length}/${competitionIds.length} competitions`,
      );

      return rankingsMap;
    } catch (error) {
      this.#logger.error("Error in getAgentRankingsInCompetitions:", error);
      throw error;
    }
  }

  /**
   * Get all portfolio snapshots
   * @param competitionId Optional competition ID to filter by
   */
  async getAllPortfolioSnapshots(competitionId?: string) {
    try {
      const query = this.#db
        .select()
        .from(portfolioSnapshots)
        .orderBy(desc(portfolioSnapshots.timestamp));

      if (competitionId) {
        query.where(eq(portfolioSnapshots.competitionId, competitionId));
      }

      return await query;
    } catch (error) {
      this.#logger.error("Error in getAllPortfolioSnapshots:", error);
      throw error;
    }
  }

  /**
   * Count total number of competitions
   */
  async count() {
    try {
      const [result] = await this.#db
        .select({ count: sql<number>`count(*)` })
        .from(competitions);

      return result?.count ?? 0;
    } catch (error) {
      this.#logger.error("[CompetitionRepository] Error in count:", error);
      throw error;
    }
  }

  /**
   * Count the number of finished competitions an agent has participated in
   * @param agentId The ID of the agent
   * @returns The number of finished competitions the agent has participated in
   */
  async countAgentCompetitions(agentId: string): Promise<number> {
    try {
      const [result] = await this.#db
        .select({ count: drizzleCount() })
        .from(competitionAgents)
        .innerJoin(
          competitions,
          eq(competitionAgents.competitionId, competitions.id),
        )
        .where(
          and(
            eq(competitionAgents.agentId, agentId),
            eq(competitions.status, "ended"),
          ),
        );

      return result?.count ?? 0;
    } catch (error) {
      this.#logger.error(
        `[CompetitionRepository] Error counting competitions for agent ${agentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find competitions by status, or default to all competitions if no status is provided
   * @param status Competition status
   * @param params Pagination parameters
   * @returns Object containing competitions array and total count
   */
  async findByStatus({
    status,
    params,
  }: {
    status: CompetitionStatus | undefined;
    params: PagingParams;
  }) {
    try {
      // Count query
      const countResult = await (() => {
        if (status) {
          return this.#db
            .select({ count: drizzleCount() })
            .from(tradingCompetitions)
            .innerJoin(
              competitions,
              eq(tradingCompetitions.competitionId, competitions.id),
            )
            .where(eq(competitions.status, status));
        } else {
          return this.#db
            .select({ count: drizzleCount() })
            .from(tradingCompetitions)
            .innerJoin(
              competitions,
              eq(tradingCompetitions.competitionId, competitions.id),
            );
        }
      })();

      const total = countResult[0]?.count ?? 0;

      // Data query with dynamic building
      let dataQuery = this.buildCompetitionWithRewardsQuery().$dynamic();

      if (status) {
        dataQuery = dataQuery.where(eq(competitions.status, status));
      }

      if (params.sort) {
        dataQuery = getSort(dataQuery, params.sort, competitionOrderByFields);
      }

      const competitionResults = await dataQuery
        .limit(params.limit)
        .offset(params.offset);

      return { competitions: competitionResults, total };
    } catch (error) {
      this.#logger.error(
        "[CompetitionRepository] Error in findByStatus:",
        error,
      );
      throw error;
    }
  }

  /**
   * Find the best placement of an agent across all competitions
   * @param agentId The agent ID
   * @returns The agent best placement
   */
  async findBestPlacementForAgent(agentId: string) {
    try {
      const [rankResult] = await this.#db
        .select()
        .from(competitionsLeaderboard)
        .where(eq(competitionsLeaderboard.agentId, agentId))
        .orderBy(asc(competitionsLeaderboard.rank))
        .limit(1);
      if (!rankResult) {
        return rankResult;
      }
      const [pnlResult] = await this.#db
        .select({
          ...getTableColumns(competitionsLeaderboard),
          ...getTableColumns(tradingCompetitionsLeaderboard),
        })
        .from(competitionsLeaderboard)
        .innerJoin(
          tradingCompetitionsLeaderboard,
          eq(
            competitionsLeaderboard.id,
            tradingCompetitionsLeaderboard.competitionsLeaderboardId,
          ),
        )
        .where(eq(competitionsLeaderboard.agentId, agentId))
        .orderBy(desc(tradingCompetitionsLeaderboard.pnl))
        .limit(1);
      const agents = await this.#db
        .select({
          count: drizzleCount(),
        })
        .from(competitionAgents)
        .where(eq(competitionAgents.competitionId, rankResult.competitionId));
      return {
        competitionId: rankResult.competitionId,
        rank: rankResult.rank,
        score: rankResult.score,
        pnl: pnlResult?.pnl,
        totalAgents: agents[0]?.count ?? 0,
      };
    } catch (error) {
      this.#logger.error(
        "[CompetitionRepository] Error in findAgentBestCompetitionRank:",
        error,
      );
      throw error;
    }
  }

  /**
   * Insert multiple leaderboard entries in a batch operation
   * @param entries Array of leaderboard entries to insert
   * @returns Array of inserted leaderboard entries
   */
  async batchInsertLeaderboard(
    entries: Omit<LeaderboardEntry, "id">[],
    tx?: Transaction,
  ): Promise<LeaderboardEntry[]> {
    if (!entries.length) {
      return [];
    }

    const executor = tx || this.#db;

    try {
      this.#logger.debug(
        `Batch inserting ${entries.length} leaderboard entries`,
      );

      const valuesToInsert = entries.map((entry) => ({
        ...entry,
        id: randomUUID(),
      }));

      let results: LeaderboardEntry[] = await executor
        .insert(competitionsLeaderboard)
        .values(valuesToInsert)
        .returning();

      const pnlsToInsert = valuesToInsert.filter((e) => e.pnl !== undefined);
      if (pnlsToInsert.length) {
        const pnlResults = await executor
          .insert(tradingCompetitionsLeaderboard)
          .values(
            pnlsToInsert.map((entry) => {
              return {
                pnl: entry.pnl,
                startingValue: entry.startingValue || 0,
                competitionsLeaderboardId: entry.id,
              };
            }),
          )
          .returning();

        results = results.map((r) => {
          const pnl = pnlResults.find(
            (p) => p.competitionsLeaderboardId === r.id,
          );
          return { ...r, pnl: pnl?.pnl, startingValue: pnl?.startingValue };
        });
      }

      return results;
    } catch (error) {
      this.#logger.error(
        "[CompetitionRepository] Error batch inserting leaderboard entries:",
        error,
      );
      throw error;
    }
  }

  /**
   * Find leaderboard entries for a specific competition
   * @param competitionId The competition ID
   * @param tx Optional database transaction
   * @returns Array of leaderboard entries sorted by rank
   */
  async findLeaderboardByCompetition(
    competitionId: string,
    tx?: Transaction,
  ): Promise<SelectCompetitionsLeaderboard[]> {
    const executor = tx || this.#db;

    try {
      return await executor
        .select()
        .from(competitionsLeaderboard)
        .where(eq(competitionsLeaderboard.competitionId, competitionId))
        .orderBy(competitionsLeaderboard.rank);
    } catch (error) {
      this.#logger.error(
        `[CompetitionRepository] Error finding leaderboard for competition ${competitionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Find leaderboard entries for a specific trading competition
   * @param competitionId The competition ID
   * @returns Array of leaderboard entries sorted by rank
   */
  async findLeaderboardByTradingComp(competitionId: string) {
    try {
      return await this.#db
        .select({
          agentId: competitionsLeaderboard.agentId,
          value: competitionsLeaderboard.score, // Alias score as value for LeaderboardEntry interface
          pnl: tradingCompetitionsLeaderboard.pnl,
        })
        .from(competitionsLeaderboard)
        .innerJoin(
          tradingCompetitionsLeaderboard,
          eq(
            competitionsLeaderboard.id,
            tradingCompetitionsLeaderboard.competitionsLeaderboardId,
          ),
        )
        .where(eq(competitionsLeaderboard.competitionId, competitionId))
        .orderBy(competitionsLeaderboard.rank);
    } catch (error) {
      this.#logger.error(
        `[CompetitionRepository] Error finding leaderboard for competition ${competitionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all competitions leaderboard entries
   * @param competitionId Optional competition ID to filter by
   */
  async getAllCompetitionsLeaderboard(competitionId?: string) {
    try {
      const query = this.#db
        .select()
        .from(competitionsLeaderboard)
        .orderBy(desc(competitionsLeaderboard.createdAt));

      if (competitionId) {
        query.where(eq(competitionsLeaderboard.competitionId, competitionId));
      }

      return await query;
    } catch (error) {
      this.#logger.error(
        "[CompetitionRepository] Error in getAllCompetitionsLeaderboard:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get all agents that have ever participated in a competition, regardless of status
   * This is useful for retrieving portfolio snapshots for all agents including inactive ones
   * @param competitionId Competition ID
   * @returns Array of agent IDs
   */
  async getAllCompetitionAgents(competitionId: string): Promise<string[]> {
    try {
      const result = await this.#db
        .select({ agentId: competitionAgents.agentId })
        .from(competitionAgents)
        .where(eq(competitionAgents.competitionId, competitionId));

      return result.map((row) => row.agentId);
    } catch (error) {
      this.#logger.error(
        "[CompetitionRepository] Error in getAllCompetitionAgents:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get agent rankings for multiple agents in a competition efficiently
   *
   * @param competitionId Competition ID
   * @param agentIds Array of agent IDs to get rankings for
   * @returns Map of agent ID to ranking data
   */
  async getBulkAgentCompetitionRankings(
    competitionId: string,
    agentIds: string[],
  ): Promise<Map<string, { rank: number; totalAgents: number }>> {
    if (agentIds.length === 0) {
      return new Map();
    }

    try {
      this.#logger.debug(
        `getBulkAgentCompetitionRankings called for ${agentIds.length} agents in competition ${competitionId}`,
      );

      // Get ALL latest portfolio snapshots for the competition ONCE
      const snapshots = await this.getLatestPortfolioSnapshots(competitionId);

      if (snapshots.length === 0) {
        return new Map(); // No snapshots = no ranking data
      }

      // Sort by totalValue descending to determine rankings ONCE
      const sortedSnapshots = snapshots.sort(
        (a, b) => Number(b.totalValue) - Number(a.totalValue),
      );

      const totalAgents = sortedSnapshots.length;
      const rankingsMap = new Map<
        string,
        { rank: number; totalAgents: number }
      >();

      // Calculate ranks for all requested agents in one pass
      for (const agentId of agentIds) {
        const agentIndex = sortedSnapshots.findIndex(
          (snapshot) => snapshot.agentId === agentId,
        );

        if (agentIndex !== -1) {
          rankingsMap.set(agentId, {
            rank: agentIndex + 1, // Convert to 1-based ranking
            totalAgents,
          });
        }
        // If agent not found in snapshots, don't add to map (undefined ranking)
      }

      this.#logger.debug(
        `Calculated rankings for ${rankingsMap.size}/${agentIds.length} agents`,
      );

      return rankingsMap;
    } catch (error) {
      this.#logger.error(
        "[CompetitionRepository] Error in getBulkAgentCompetitionRankings:",
        error,
      );
      // Return empty map on error - no reliable ranking data
      return new Map();
    }
  }

  /**
   * Find competitions that need ending (active past end date or stuck in ending)
   * @returns Array of competitions that should be processed
   */
  async findCompetitionsNeedingEnding() {
    try {
      const now = new Date();

      const result = await this.#db
        .select({
          crossChainTradingType: tradingCompetitions.crossChainTradingType,
          ...getTableColumns(competitions),
        })
        .from(tradingCompetitions)
        .innerJoin(
          competitions,
          eq(tradingCompetitions.competitionId, competitions.id),
        )
        .where(
          or(
            // Normal case: active competitions past end date
            and(
              eq(competitions.status, "active"),
              isNotNull(competitions.endDate),
              lte(competitions.endDate, now),
            ),
            // Recovery case: competitions stuck in "ending" state
            eq(competitions.status, "ending"),
          ),
        );
      return result;
    } catch (error) {
      this.#logger.error(
        "[CompetitionRepository] Error in findCompetitionsNeedingEnding:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get portfolio timeline for agents in a competition
   * @param competitionId Competition ID
   * @param bucket Time bucket interval in minutes (default: 30)
   * @returns Array of portfolio timelines per agent
   */
  async getAgentPortfolioTimeline(competitionId: string, bucket: number = 30) {
    try {
      const result = await this.#dbRead.execute<{
        timestamp: string;
        agent_id: string;
        agent_name: string;
        competition_id: string;
        total_value: number;
      }>(sql`
      SELECT
        timestamp,
        agent_id,
        name AS agent_name,
        competition_id,
        total_value
      FROM (
        SELECT
          ROW_NUMBER() OVER (
            PARTITION BY ps.agent_id, ps.competition_id,FLOOR(EXTRACT(EPOCH FROM (ps.timestamp - c.start_date)) / 60 / ${bucket})
            ORDER BY ps.timestamp DESC
          ) AS rn,
          ps.timestamp,
          ps.agent_id,
          a.name,
          ps.competition_id,
          ps.total_value
        FROM competition_agents ca
        JOIN trading_comps.portfolio_snapshots ps
          ON ps.agent_id = ca.agent_id
          AND ps.competition_id = ca.competition_id
        JOIN agents a ON a.id = ca.agent_id
        JOIN competitions c ON c.id = ca.competition_id
        WHERE ca.competition_id = ${competitionId}
          AND ca.status = ${"active"}
      ) AS ranked_snapshots
      WHERE rn = 1
    `);

      // Convert snake_case to camelCase
      return result.rows.map((row) => ({
        timestamp: row.timestamp,
        agentId: row.agent_id,
        agentName: row.agent_name,
        competitionId: row.competition_id,
        totalValue: Number(row.total_value),
      }));
    } catch (error) {
      this.#logger.error("Error in getAgentPortfolioTimeline:", error);
      throw error;
    }
  }

  /**
   * Get enriched competition data with votes and trading constraints in a single query
   * @param userId The user ID to get voting state for
   * @param competitionIds Array of competition IDs to enrich
   * @returns Enriched competition data with voting and constraint information
   */
  async getEnrichedCompetitions(
    userId: string,
    competitionIds: string[],
  ): Promise<
    {
      competitionId: string;
      competitionStatus: string;
      competitionVotingStartsAt: Date | null;
      competitionVotingEndsAt: Date | null;
      userVoteAgentId: string | null;
      userVoteCreatedAt: Date | null;
      minimumPairAgeHours: number | null;
      minimum24hVolumeUsd: number | null;
      minimumLiquidityUsd: number | null;
      minimumFdvUsd: number | null;
      minTradesPerDay: number | null;
    }[]
  > {
    if (competitionIds.length === 0) {
      return [];
    }

    try {
      const result = await this.#db
        .select({
          // Competition fields
          competitionId: competitions.id,
          competitionStatus: competitions.status,
          competitionVotingStartsAt: competitions.votingStartDate,
          competitionVotingEndsAt: competitions.votingEndDate,

          // User vote info
          userVoteAgentId: votes.agentId,
          userVoteCreatedAt: votes.createdAt,

          // Trading constraints
          minimumPairAgeHours: tradingConstraints.minimumPairAgeHours,
          minimum24hVolumeUsd: tradingConstraints.minimum24hVolumeUsd,
          minimumLiquidityUsd: tradingConstraints.minimumLiquidityUsd,
          minimumFdvUsd: tradingConstraints.minimumFdvUsd,
          minTradesPerDay: tradingConstraints.minTradesPerDay,
        })
        .from(competitions)
        .leftJoin(
          votes,
          and(
            eq(votes.competitionId, competitions.id),
            eq(votes.userId, userId),
          ),
        )
        .leftJoin(
          tradingConstraints,
          eq(tradingConstraints.competitionId, competitions.id),
        )
        .where(inArray(competitions.id, competitionIds));

      return result.map((row) => ({
        competitionId: row.competitionId,
        competitionStatus: row.competitionStatus,
        competitionVotingStartsAt: row.competitionVotingStartsAt,
        competitionVotingEndsAt: row.competitionVotingEndsAt,
        userVoteAgentId: row.userVoteAgentId,
        userVoteCreatedAt: row.userVoteCreatedAt,
        minimumPairAgeHours: row.minimumPairAgeHours,
        minimum24hVolumeUsd: row.minimum24hVolumeUsd,
        minimumLiquidityUsd: row.minimumLiquidityUsd,
        minimumFdvUsd: row.minimumFdvUsd,
        minTradesPerDay: row.minTradesPerDay,
      }));
    } catch (error) {
      this.#logger.error("Error in getEnrichedCompetitions:", error);
      throw error;
    }
  }

  /**
   * Get vote counts for multiple competitions in a single query
   * @param competitionIds Array of competition IDs
   * @returns Map of competition ID to Map of agent ID to vote count
   */
  async getBatchVoteCounts(
    competitionIds: string[],
  ): Promise<
    Map<string, { agentVotes: Map<string, number>; totalVotes: number }>
  > {
    if (competitionIds.length === 0) {
      return new Map();
    }

    try {
      const voteCounts = await this.#db
        .select({
          competitionId: votes.competitionId,
          agentId: votes.agentId,
          voteCount: drizzleCount(),
        })
        .from(votes)
        .where(inArray(votes.competitionId, competitionIds))
        .groupBy(votes.competitionId, votes.agentId)
        .orderBy(votes.competitionId, desc(drizzleCount()));

      const competitionVoteMap = new Map<
        string, // competitionId
        { agentVotes: Map<string, number>; totalVotes: number }
      >();

      for (const { competitionId, agentId, voteCount } of voteCounts) {
        if (!competitionVoteMap.has(competitionId)) {
          competitionVoteMap.set(competitionId, {
            agentVotes: new Map(),
            totalVotes: 0,
          });
        }
        const competition = competitionVoteMap.get(competitionId);
        if (!competition) {
          // This is only here to keep typescript and auto code review happy
          // since the `has()` check above ensures the competition value exists
          continue;
        }
        competition.agentVotes.set(agentId, voteCount);
        competition.totalVotes += voteCount;
      }

      return competitionVoteMap;
    } catch (error) {
      this.#logger.error("Error in getBatchVoteCounts:", error);
      throw error;
    }
  }
}
