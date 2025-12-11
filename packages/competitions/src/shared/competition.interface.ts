import { Transaction } from "@recallnet/db/types";

/**
 * Competition status values representing the lifecycle states of a competition.
 */
export type CompetitionStatus = "pending" | "active" | "ending" | "ended";

/**
 * Competition type values
 */
export type CompetitionType =
  | "trading"
  | "perpetual_futures"
  | "spot_live_trading"
  | "sports_prediction";

/**
 * Cross-chain trading type
 */
export type CrossChainTradingType =
  | "disallowAll"
  | "allowAll"
  | "allowEVMOnly"
  | "allowSVMOnly";

/**
 * Evaluation metric for perpetual futures competitions
 */
export type EvaluationMetric =
  | "calmar_ratio"
  | "sortino_ratio"
  | "simple_return";

/**
 * Engine type for competition routing
 */
export type EngineType = string;

/**
 * Allocation unit for rewards
 */
export type AllocationUnit = "percentage" | "fixed";

/**
 * Display state for UI
 */
export type DisplayState = string;

/**
 * Specific blockchain chain identifier
 */
export type SpecificChain =
  | "eth"
  | "polygon"
  | "bsc"
  | "arbitrum"
  | "optimism"
  | "avalanche"
  | "base"
  | "linea"
  | "mantle"
  | "svm";

/**
 * Trading constraints input
 */
export interface TradingConstraintsInput {
  minimumPairAgeHours?: number;
  minimum24hVolumeUsd?: number;
  minimumLiquidityUsd?: number;
  minimumFdvUsd?: number;
}

/**
 * Base parameters shared across all competition types
 */
export interface BaseCompetitionParams {
  /** Name of the competition */
  name: string;
  /** Arena ID the competition belongs to (required) */
  arenaId: string;
  /** Optional description of the competition */
  description?: string;

  /** Whether sandbox mode is enabled */
  sandboxMode?: boolean;
  /** External URL for competition details */
  externalUrl?: string;
  /** Image URL for the competition */
  imageUrl?: string;
  /** Competition type */
  type?: CompetitionType;
  /** Start date for the competition */
  startDate?: Date;
  /** End date for the competition */
  endDate?: Date;
  /** Boost start date */
  boostStartDate?: Date;
  /** Boost end date */
  boostEndDate?: Date;
  /** Join start date */
  joinStartDate?: Date;
  /** Join end date */
  joinEndDate?: Date;
  /** Maximum number of participants */
  maxParticipants?: number;

  /** Rewards mapping (rank -> reward amount) */
  rewards?: Record<number, number>;
  /** Minimum stake requirement */
  minimumStake?: number;
  /** Prize pools for agent and users */
  prizePools?: {
    agent: number;
    users: number;
  };
  /** List of agent IDs ineligible for rewards */
  rewardsIneligible?: string[];
  /** Engine ID for routing */
  engineId?: EngineType;
  /** Engine version */
  engineVersion?: string;
  /** VIP agent IDs */
  vips?: string[];
  /** Allowlist of agent IDs */
  allowlist?: string[];
  /** Blocklist of agent IDs */
  blocklist?: string[];
  /** Minimum Recall rank requirement */
  minRecallRank?: number;
  /** Whether competition is allowlist-only */
  allowlistOnly?: boolean;
  /** Agent allocation amount */
  agentAllocation?: number;
  /** Agent allocation unit */
  agentAllocationUnit?: AllocationUnit;
  /** Booster allocation amount */
  boosterAllocation?: number;
  /** Booster allocation unit */
  boosterAllocationUnit?: AllocationUnit;
  /** Reward rules description */
  rewardRules?: string;
  /** Reward details */
  rewardDetails?: string;
  /** Boost time decay rate */
  boostTimeDecayRate?: number;
  /** Display state */
  displayState?: DisplayState;
}

/**
 * Configuration for paper trading competitions (type: "trading")
 */
export interface PaperTradingCompetitionConfig {
  /** Cross-chain trading type */
  tradingType?: CrossChainTradingType;
  /** Paper trading configuration */
  config?: {
    maxTradePercentage?: number;
  };
  /** Initial balances for paper trading (required when type is "trading") */
  initialBalances?: Array<{
    specificChain: string;
    tokenSymbol: string;
    amount: number;
  }>;
  /** Trading constraints */
  constraints?: TradingConstraintsInput;
}

/**
 * Parameters for creating a paper trading competition
 */
export interface CreatePaperTradingCompetitionParams
  extends BaseCompetitionParams,
    PaperTradingCompetitionConfig {
  type: "trading";
}

/**
 * Flexible parameters for creating a competition with required type
 * When type is "trading", PaperTradingCompetitionConfig fields are required
 */
export type CreateCompetitionParamsFlexible =
  | (BaseCompetitionParams &
      PaperTradingCompetitionConfig & {
        type: "trading";
      })
  | (BaseCompetitionParams &
      Partial<PaperTradingCompetitionConfig> & {
        type: Exclude<CompetitionType, "trading">;
      });

/**
 * Union type for all competition creation parameters with type-specific requirements
 * When a specific type is set, the corresponding configuration becomes required
 */
export type CreateCompetitionParams =
  | CreatePaperTradingCompetitionParams
  | CreateCompetitionParamsFlexible;

/**
 * Result of creating a competition.
 */
export interface CreateCompetitionResult {
  /** Unique identifier of the created competition */
  id: string;
  /** Status of the competition after creation */
  status: CompetitionStatus;
}

/**
 * Interface defining the lifecycle operations for competitions.
 *
 * This interface provides methods to manage the complete lifecycle of a competition,
 * from creation through starting and ending.
 */
export interface ICompetitionService {
  /**
   * Creates a new competition.
   *
   * @param params - Parameters for creating the competition
   * @returns Promise resolving to the created competition result
   */
  createCompetition(
    params: CreateCompetitionParams,
    tx: Transaction,
  ): Promise<CreateCompetitionResult>;
}
