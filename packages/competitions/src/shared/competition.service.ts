import { randomUUID } from "crypto";

import { valueToAttoBigInt } from "@recallnet/conversions/atto-conversions";
import type { ArenaRepository } from "@recallnet/db/repositories/arena";
import type { CompetitionRepository } from "@recallnet/db/repositories/competition";
import type { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import type {
  InsertCompetition,
  InsertCompetitionReward,
} from "@recallnet/db/schema/core/types";
import type { InsertTradingCompetition } from "@recallnet/db/schema/trading/types";
import type { Database, Transaction } from "@recallnet/db/types";

import type {
  CompetitionStatus,
  CompetitionType,
  CreateCompetitionParams,
  CreateCompetitionResult,
  ICompetitionService,
} from "./competition.interface.js";

/**
 * Arena information needed for validation
 */
export interface ArenaInfo {
  id: string;
  skill: string;
}

/**
 * Base competition data structure for creation
 */
export interface BaseCompetitionData {
  id: string;
  name: string;
  description: string | null;
  externalUrl: string | null;
  imageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  boostStartDate: Date | null;
  boostEndDate: Date | null;
  joinStartDate: Date | null;
  joinEndDate: Date | null;
  maxParticipants: number | null;
  minimumStake: number | null;
  rewardsIneligible: string[] | null;
  status: CompetitionStatus;
  crossChainTradingType: string;
  sandboxMode: boolean;
  type: CompetitionType;
  createdAt: Date;
  updatedAt: Date;
  arenaId: string;
  engineId: string | null;
  engineVersion: string | null;
  vips: string[] | null;
  allowlist: string[] | null;
  blocklist: string[] | null;
  minRecallRank: number | null;
  allowlistOnly: boolean;
  agentAllocation: number | null;
  agentAllocationUnit: string | null;
  boosterAllocation: number | null;
  boosterAllocationUnit: string | null;
  rewardRules: string | null;
  rewardDetails: string | null;
  boostTimeDecayRate: number | null;
  displayState: string | null;
}

/**
 * Maps arena skills to compatible competition types
 */
export const SKILL_TYPE_COMPATIBILITY: Record<string, CompetitionType[]> = {
  spot_paper_trading: ["trading"],
  perpetual_futures: ["perpetual_futures"],
  spot_live_trading: ["spot_live_trading"],
};

/**
 * Validates that a competition type is compatible with an arena's skill
 * @param arenaSkill The arena's skill type
 * @param competitionType The competition type to validate
 * @returns True if compatible, false otherwise
 */
export function isCompatibleType(
  arenaSkill: string,
  competitionType: CompetitionType,
): boolean {
  const compatibleTypes = SKILL_TYPE_COMPATIBILITY[arenaSkill];

  if (!compatibleTypes) {
    // Unknown skill - allow for backward compatibility but should be rare
    return true;
  }

  return compatibleTypes.includes(competitionType);
}

/**
 * Base competition service that implements shared logic for competition creation.
 * This class handles the common aspects of competition creation that apply to all competition types.
 */
export class BaseCompetitionService implements ICompetitionService {
  private arenaRepo: ArenaRepository;
  private competitionRepo: CompetitionRepository;
  private competitionRewardsRepo: CompetitionRewardsRepository;
  private db: Database;

  constructor(
    arenaRepo: ArenaRepository,
    competitionRepo: CompetitionRepository,
    competitionRewardsRepo: CompetitionRewardsRepository,
    db: Database,
  ) {
    this.arenaRepo = arenaRepo;
    this.competitionRepo = competitionRepo;
    this.competitionRewardsRepo = competitionRewardsRepo;
    this.db = db;
  }

  /**
   * Creates a new competition with shared validation and base record creation.
   * Type-specific configuration (perps, spot live, paper trading, etc.) should be handled
   * by overriding this method or implementing the abstract type-specific methods.
   *
   * @param params Parameters for creating the competition
   * @returns Promise resolving to the created competition result
   */
  async createCompetition(
    params: CreateCompetitionParams,
    tx: Transaction,
  ): Promise<CreateCompetitionResult> {
    const id = randomUUID();
    const competitionType = params.type ?? "trading";

    // Validate arena compatibility if arenaId provided
    if (params.arenaId) {
      const arena = await this.getArenaById(params.arenaId);
      if (!arena) {
        throw new Error(`Arena with ID ${params.arenaId} not found`);
      }

      if (!isCompatibleType(arena.skill, competitionType)) {
        throw new Error(
          `Competition type "${competitionType}" incompatible with arena skill "${arena.skill}"`,
        );
      }
    }

    // Build base competition data structure
    const competitionData: BaseCompetitionData = {
      id,
      name: params.name,
      description: params.description ?? null,
      externalUrl: params.externalUrl ?? null,
      imageUrl: params.imageUrl ?? null,
      startDate: params.startDate ?? null,
      endDate: params.endDate ?? null,
      boostStartDate: params.boostStartDate ?? null,
      boostEndDate: params.boostEndDate ?? null,
      joinStartDate: params.joinStartDate ?? null,
      joinEndDate: params.joinEndDate ?? null,
      maxParticipants: params.maxParticipants ?? null,
      minimumStake: params.minimumStake ?? null,
      rewardsIneligible: params.rewardsIneligible ?? null,
      status: "pending",
      crossChainTradingType:
        ("tradingType" in params ? params.tradingType : undefined) ??
        ("disallowAll" as const),
      sandboxMode: params.sandboxMode ?? false,
      type: competitionType,
      createdAt: new Date(),
      updatedAt: new Date(),
      arenaId: params.arenaId,
      engineId: params.engineId ?? null,
      engineVersion: params.engineVersion ?? null,
      vips: params.vips ?? null,
      allowlist: params.allowlist ?? null,
      blocklist: params.blocklist ?? null,
      minRecallRank: params.minRecallRank ?? null,
      allowlistOnly: params.allowlistOnly ?? false,
      agentAllocation: params.agentAllocation ?? null,
      agentAllocationUnit: params.agentAllocationUnit ?? null,
      boosterAllocation: params.boosterAllocation ?? null,
      boosterAllocationUnit: params.boosterAllocationUnit ?? null,
      rewardRules: params.rewardRules ?? null,
      rewardDetails: params.rewardDetails ?? null,
      boostTimeDecayRate: params.boostTimeDecayRate ?? null,
      displayState: params.displayState ?? null,
    };

    // Execute all operations in a single transaction
    await this.executeTransaction(async (tx) => {
      // Create the base competition record
      await this.createCompetitionRecord(competitionData, tx);

      // Create rewards if provided
      if (params.rewards) {
        await this.createRewards(id, params.rewards, tx);
      }

      // Create prize pools if provided
      if (params.prizePools) {
        const attoPrizePools = {
          agent: this.valueToAttoBigInt(params.prizePools.agent),
          users: this.valueToAttoBigInt(params.prizePools.users),
        };
        await this.updatePrizePools(id, attoPrizePools, tx);
      }
    });

    return {
      id,
      status: "pending",
    };
  }

  /**
   * Fetches arena information by ID for validation
   * @param arenaId The arena ID to fetch
   * @returns Arena information or null if not found
   */
  protected async getArenaById(arenaId: string): Promise<ArenaInfo | null> {
    const arena = await this.arenaRepo.findById(arenaId);
    if (!arena) {
      return null;
    }
    return {
      id: arena.id,
      skill: arena.skill,
    };
  }

  /**
   * Creates the base competition record in the database
   * @param competitionData The base competition data to create
   * @param tx Database transaction
   */
  protected async createCompetitionRecord(
    competitionData: BaseCompetitionData,
    tx: Transaction,
  ): Promise<void> {
    const insertData: InsertCompetition &
      Omit<InsertTradingCompetition, "competitionId"> = {
      id: competitionData.id,
      name: competitionData.name,
      description: competitionData.description,
      externalUrl: competitionData.externalUrl,
      imageUrl: competitionData.imageUrl,
      startDate: competitionData.startDate,
      endDate: competitionData.endDate,
      boostStartDate: competitionData.boostStartDate,
      boostEndDate: competitionData.boostEndDate,
      joinStartDate: competitionData.joinStartDate,
      joinEndDate: competitionData.joinEndDate,
      maxParticipants: competitionData.maxParticipants,
      minimumStake: competitionData.minimumStake,
      rewardsIneligible: competitionData.rewardsIneligible,
      status: competitionData.status,
      sandboxMode: competitionData.sandboxMode,
      type: competitionData.type as InsertCompetition["type"] | undefined,
      createdAt: competitionData.createdAt,
      updatedAt: competitionData.updatedAt,
      arenaId: competitionData.arenaId,
      engineId: competitionData.engineId as InsertCompetition["engineId"],
      engineVersion: competitionData.engineVersion as
        | InsertCompetition["engineVersion"]
        | null,
      vips: competitionData.vips,
      allowlist: competitionData.allowlist,
      blocklist: competitionData.blocklist,
      minRecallRank: competitionData.minRecallRank,
      allowlistOnly: competitionData.allowlistOnly,
      agentAllocation: competitionData.agentAllocation,
      agentAllocationUnit: competitionData.agentAllocationUnit as
        | InsertCompetition["agentAllocationUnit"]
        | null,
      boosterAllocation: competitionData.boosterAllocation,
      boosterAllocationUnit: competitionData.boosterAllocationUnit as
        | InsertCompetition["boosterAllocationUnit"]
        | null,
      rewardRules: competitionData.rewardRules,
      rewardDetails: competitionData.rewardDetails,
      boostTimeDecayRate: competitionData.boostTimeDecayRate,
      displayState: competitionData.displayState as
        | InsertCompetition["displayState"]
        | null,
      crossChainTradingType: competitionData.crossChainTradingType as
        | InsertTradingCompetition["crossChainTradingType"]
        | undefined,
    };

    await this.competitionRepo.create(insertData, tx);
  }

  /**
   * Creates rewards for a competition
   * @param competitionId The competition ID
   * @param rewards Rewards mapping (rank -> reward amount)
   * @param tx Database transaction
   */
  protected async createRewards(
    competitionId: string,
    rewards: Record<number, number>,
    tx: Transaction,
  ): Promise<void> {
    const rewardsData: InsertCompetitionReward[] = Object.entries(rewards).map(
      ([rank, reward]) => ({
        id: randomUUID(),
        competitionId,
        rank: Number(rank),
        reward,
      }),
    );

    await this.competitionRewardsRepo.createRewards(rewardsData, tx);
  }

  /**
   * Updates prize pools for a competition
   * @param competitionId The competition ID
   * @param prizePools Prize pools data (agent and users amounts as BigInt strings)
   * @param tx Database transaction
   */
  protected async updatePrizePools(
    competitionId: string,
    prizePools: { agent: string; users: string },
    tx: Transaction,
  ): Promise<void> {
    await this.competitionRepo.updatePrizePools(
      competitionId,
      {
        agent: BigInt(prizePools.agent),
        users: BigInt(prizePools.users),
      },
      tx,
    );
  }

  /**
   * Executes operations within a database transaction
   * @param callback Function to execute within the transaction
   * @returns Result of the transaction callback
   */
  protected async executeTransaction<T>(
    callback: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(callback);
  }

  /**
   * Converts a numeric value to atto (BigInt string representation)
   * @param value The numeric value to convert
   * @returns String representation of the value in atto units
   */
  protected valueToAttoBigInt(value: number): string {
    return valueToAttoBigInt(value).toString();
  }
}
