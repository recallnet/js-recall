import { Logger } from "pino";

import { AirdropRepository } from "@recallnet/db/repositories/airdrop";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";
import { Season } from "@recallnet/db/schema/airdrop/types";

export type BaseClaim = {
  airdrop: number;
  airdropName: string;
};

export type AvailableClaim = BaseClaim & {
  type: "available";
  eligibleAmount: bigint;
  expiresAt: Date;
  proof: string[];
};

export type ClaimedAndStakedClaim = BaseClaim & {
  type: "claimed-and-staked";
  eligibleAmount: bigint;
  claimedAmount: bigint;
  stakeDuration: number;
  claimedAt: Date;
  unlocksAt: Date;
};

export type ClaimedAndNotStakedClaim = BaseClaim & {
  type: "claimed-and-not-staked";
  eligibleAmount: bigint;
  claimedAmount: bigint;
  claimedAt: Date;
};

export type ExpiredClaim = BaseClaim & {
  type: "expired";
  eligibleAmount: bigint;
  expiredAt: Date;
};

export type IneligibleClaim = BaseClaim & {
  type: "ineligible";
  ineligibleReason: string;
  ineligibleAmount: bigint;
};

export type ClaimData =
  | AvailableClaim
  | ClaimedAndStakedClaim
  | ClaimedAndNotStakedClaim
  | ExpiredClaim
  | IneligibleClaim;

/**
 * Default minimum number of distinct competitions required for eligibility
 */
export const DEFAULT_MIN_COMPETITIONS_FOR_ELIGIBILITY = 3;

/**
 * Eligibility reasons explaining why a user qualifies for conviction rewards
 */
export interface EligibilityReasons {
  hasBoostedAgents: boolean;
  hasCompetedInCompetitions: boolean;
  /** Competition IDs where the user boosted agents */
  boostedCompetitionIds: string[];
  /** Competition IDs where the user's agents competed */
  competedCompetitionIds: string[];
  /** Total count of unique competitions (boosted + competed combined) */
  totalUniqueCompetitions: number;
}

/**
 * Pool statistics for the conviction rewards
 */
export interface ConvictionPoolStats {
  totalActiveStakes: bigint;
  availableRewardsPool: bigint;
  totalForfeited: bigint;
  totalAlreadyClaimed: bigint;
}

/**
 * Season metadata used to describe a time window.
 */
export interface EligibilitySeasonMetadata {
  /** Season number (as stored in the airdrop seasons table). */
  number: number;
  /** Human-readable season name. */
  name: string;
  /** Inclusive season start time. */
  startDate: Date;
  /** Inclusive season end time. */
  endDate: Date;
}

/**
 * Full eligibility data for next airdrop conviction rewards
 */
export interface NextAirdropEligibility {
  isEligible: boolean;
  airdrop: number;
  activeStake: bigint;
  potentialReward: bigint;
  eligibilityReasons: EligibilityReasons;
  poolStats: ConvictionPoolStats;
  /**
   * Season used as the activity window for eligibility checks (boosting and competitions),
   * and as the cutoff for determining whether a stake remains locked.
   */
  activitySeason: EligibilitySeasonMetadata;
}

export class AirdropService {
  private readonly airdropRepository: AirdropRepository;
  private readonly convictionClaimsRepository: ConvictionClaimsRepository;
  private readonly boostRepository: BoostRepository;
  private readonly competitionRepository: CompetitionRepository;
  private readonly logger: Logger;
  private readonly minCompetitionsForEligibility: number;

  constructor(
    airdropRepository: AirdropRepository,
    logger: Logger,
    convictionClaimsRepository: ConvictionClaimsRepository,
    boostRepository: BoostRepository,
    competitionRepository: CompetitionRepository,
    minCompetitionsForEligibility: number = DEFAULT_MIN_COMPETITIONS_FOR_ELIGIBILITY,
  ) {
    this.airdropRepository = airdropRepository;
    this.convictionClaimsRepository = convictionClaimsRepository;
    this.boostRepository = boostRepository;
    this.competitionRepository = competitionRepository;
    this.logger = logger;
    this.minCompetitionsForEligibility = minCompetitionsForEligibility;
  }

  /**
   * Calculate unlock date for staked tokens
   * Uses UTC-safe arithmetic to avoid DST issues
   */
  private calculateUnlockDate(
    claimTimestamp: Date,
    durationInSeconds: bigint,
  ): Date {
    return new Date(
      claimTimestamp.getTime() + Number(durationInSeconds) * 1000,
    );
  }

  /**
   * Get display name for an airdrop
   * Airdrop 0 is "Genesis", all others are "Airdrop X"
   */
  private getAirdropName(airdrop: number): string {
    return airdrop === 0 ? "Genesis" : `Airdrop ${airdrop}`;
  }

  /**
   * Get all airdrop claims data for an account across all seasons
   */
  async getAccountClaimsData(address: string): Promise<ClaimData[]> {
    try {
      this.logger.info(`Fetching claims data for address: ${address}`);

      const seasons = await this.airdropRepository.getSeasons();
      const seasonsByAirdropNumber = seasons.reduce(
        (acc, season) => {
          acc[season.startsWithAirdrop] = season;
          return acc;
        },
        {} as Record<number, Season>,
      );

      // Get all airdrop allocations for the address
      const allocations =
        await this.airdropRepository.getAllAllocationsForAddress(address);

      // Get conviction claims data if repository is available
      const convictionClaims =
        await this.convictionClaimsRepository.getClaimsByAccount(address);

      // Build claims data for each allocation
      const claimsData: ClaimData[] = allocations.map((allocation) => {
        // Find corresponding conviction claim for this season
        const convictionClaim = convictionClaims.find(
          (cc) => cc.season === allocation.airdrop, // Note that conviction claims "seasons" correspond to our airdrop numbers
        );

        const season = seasonsByAirdropNumber[allocation.airdrop];
        if (!season) {
          throw new Error(
            `Season starting with airdrop ${allocation.airdrop} not found for allocation`,
          );
        }

        const ineligibleReason =
          allocation.sybilClassification === "sybil"
            ? allocation.flaggingReason || "Sybil flagged"
            : allocation.flaggingReason
              ? allocation.flaggingReason
              : allocation.ineligibleReason
                ? allocation.ineligibleReason
                : undefined;

        if (ineligibleReason) {
          return {
            type: "ineligible",
            airdrop: allocation.airdrop,
            airdropName: this.getAirdropName(allocation.airdrop),
            ineligibleReason,
            ineligibleAmount: allocation.ineligibleReward || 0n,
          };
        } else if (!convictionClaim) {
          // Determine if the claim has expired
          // Use UTC-safe date arithmetic to avoid DST issues
          const daysToAdd = allocation.airdrop > 0 ? 30 : 90;
          const expirationTimestamp = new Date(
            season.startDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000,
          );
          const now = new Date();
          const expired = now > expirationTimestamp;

          if (expired) {
            return {
              type: "expired",
              airdrop: allocation.airdrop,
              airdropName: this.getAirdropName(allocation.airdrop),
              eligibleAmount: allocation.amount,
              expiredAt: expirationTimestamp,
            };
          }
          return {
            type: "available",
            airdrop: allocation.airdrop,
            airdropName: this.getAirdropName(allocation.airdrop),
            eligibleAmount: allocation.amount,
            expiresAt: expirationTimestamp,
            proof: allocation.airdrop > 0 ? allocation.proof : [],
          };
        } else if (convictionClaim.duration > 0n) {
          return {
            type: "claimed-and-staked",
            airdrop: allocation.airdrop,
            airdropName: this.getAirdropName(allocation.airdrop),
            eligibleAmount: convictionClaim.eligibleAmount,
            claimedAmount: convictionClaim.claimedAmount,
            stakeDuration: Number(convictionClaim.duration),
            claimedAt: convictionClaim.blockTimestamp,
            unlocksAt: this.calculateUnlockDate(
              convictionClaim.blockTimestamp,
              convictionClaim.duration,
            ),
          };
        } else if (convictionClaim.duration === 0n) {
          return {
            type: "claimed-and-not-staked",
            airdrop: allocation.airdrop,
            airdropName: this.getAirdropName(allocation.airdrop),
            eligibleAmount: convictionClaim.eligibleAmount,
            claimedAmount: convictionClaim.claimedAmount,
            claimedAt: convictionClaim.blockTimestamp,
          };
        } else {
          // This should be unreachable if all conditions are properly handled
          throw new Error(
            `Unexpected state for allocation: airdrop=${allocation.airdrop}, ` +
              `hasEndDate=${!!season.endDate}, hasConvictionClaim=${!!convictionClaim}, ` +
              `ineligibleReason=${ineligibleReason}`,
          );
        }
      });

      // Sort by season (most recent first)
      claimsData.sort((a, b) => b.airdrop - a.airdrop);

      this.logger.info(
        `Successfully fetched ${claimsData.length} claims for address ${address}`,
      );

      return claimsData;
    } catch (error) {
      this.logger.error(
        { error },
        `Error fetching claims data for address ${address}`,
      );
      throw error;
    }
  }

  /**
   * Get eligibility data for next airdrop conviction rewards.
   *
   * Calculates whether an address is eligible for airdrop conviction rewards based on:
   * - Having active stakes (conviction claims with duration > 0 extending past the airdrop time)
   * - Participating in at least 3 distinct competitions (boosting OR competing combined)
   *   during the season preceding the airdrop
   *
   * @param address - Wallet address to check
   * @param airdropNumber - Optional target airdrop number. When provided, checks activity for
   *   the preceding season. When omitted, uses the current season as the activity window and
   *   targets the next season's airdrop.
   * @returns Full eligibility data including potential reward and pool statistics
   */
  async getNextAirdropEligibility(
    address: string,
    airdropNumber?: number,
  ): Promise<NextAirdropEligibility> {
    try {
      const normalizedAddress = address.toLowerCase();
      this.logger.info(
        `Calculating next season eligibility for address: ${normalizedAddress}`,
      );

      // Determine the activity season (current season) and target season
      let currentSeason: Season;
      let targetAirdropNumber: number;

      if (airdropNumber !== undefined) {
        // When a specific target airdrop is provided, activity is checked for the preceding season
        const activitySeasonAirdropNumber = airdropNumber - 1;
        const foundActivitySeason =
          await this.airdropRepository.getSeasonStartingWithAirdrop(
            activitySeasonAirdropNumber,
          );
        if (!foundActivitySeason) {
          throw new Error(
            `Activity season airdrop ${activitySeasonAirdropNumber} not found`,
          );
        }
        currentSeason = foundActivitySeason;
        targetAirdropNumber = airdropNumber;
      } else {
        // Default: use date-based current season detection
        const foundCurrentSeason =
          await this.airdropRepository.getCurrentSeason();
        if (!foundCurrentSeason) {
          throw new Error(
            "No current season found based on current date. Check that season date ranges cover the current time.",
          );
        }
        currentSeason = foundCurrentSeason;
        targetAirdropNumber = foundCurrentSeason.startsWithAirdrop + 1;
      }

      // Calculate pool statistics
      const poolStats = await this.calculatePoolStats(currentSeason);

      // Get user's active stake for the season
      const activeStake =
        await this.convictionClaimsRepository.getActiveStakeForAccount(
          normalizedAddress,
          currentSeason.endDate,
        );

      // Check eligibility reasons
      const eligibilityReasons = await this.checkEligibilityReasons(
        normalizedAddress,
        currentSeason,
      );

      // User is eligible if they have active stakes AND participated in minimum competitions
      const hasActivityEligibility =
        eligibilityReasons.totalUniqueCompetitions >=
        this.minCompetitionsForEligibility;
      const isEligible = activeStake > 0n && hasActivityEligibility;

      // Calculate potential reward
      let potentialReward = 0n;
      if (
        isEligible &&
        poolStats.totalActiveStakes > 0n &&
        poolStats.availableRewardsPool > 0n
      ) {
        potentialReward =
          (activeStake * poolStats.availableRewardsPool) /
          poolStats.totalActiveStakes;
      }

      const result: NextAirdropEligibility = {
        isEligible,
        airdrop: targetAirdropNumber,
        activeStake,
        potentialReward,
        eligibilityReasons,
        poolStats,
        activitySeason: {
          number: currentSeason.number,
          name: currentSeason.name,
          startDate: currentSeason.startDate,
          endDate: currentSeason.endDate,
        },
      };

      this.logger.info(
        {
          address: normalizedAddress,
          isEligible,
          airdrop: targetAirdropNumber,
          activeStake: activeStake.toString(),
          potentialReward: potentialReward.toString(),
          totalUniqueCompetitions: eligibilityReasons.totalUniqueCompetitions,
        },
        `Successfully calculated eligibility for address ${normalizedAddress}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        { error },
        `Error calculating eligibility for address ${address}`,
      );
      throw error;
    }
  }

  /**
   * Calculate conviction pool statistics for a season.
   *
   * @param season - The season to calculate stats for
   * @returns Pool statistics including total stakes, forfeitures, and available pool
   */
  private async calculatePoolStats(
    season: Season,
  ): Promise<ConvictionPoolStats> {
    // Get total active stakes for the season
    const totalActiveStakes =
      await this.convictionClaimsRepository.getTotalActiveStakesForSeason(
        season.endDate,
      );

    // Get total forfeited amounts up to season end
    const totalForfeited =
      await this.convictionClaimsRepository.getTotalForfeitedUpToDate(
        season.endDate,
      );

    // Get total conviction rewards already claimed (season 1 onwards)
    const totalAlreadyClaimed =
      await this.convictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason(
        1,
        season.startsWithAirdrop,
      );

    // Available pool = total forfeited - already claimed
    const availableRewardsPool = totalForfeited - totalAlreadyClaimed;

    return {
      totalActiveStakes,
      availableRewardsPool:
        availableRewardsPool > 0n ? availableRewardsPool : 0n,
      totalForfeited,
      totalAlreadyClaimed,
    };
  }

  /**
   * Check eligibility reasons for a wallet address.
   *
   * @param address - The wallet address to check
   * @param season - The season to check activity for
   * @returns Object indicating which eligibility criteria are met
   */
  private async checkEligibilityReasons(
    address: string,
    season: Season,
  ): Promise<EligibilityReasons> {
    // Get competition IDs where user boosted agents during the season
    let boostedCompetitionIds: string[] = [];
    if (this.boostRepository) {
      boostedCompetitionIds =
        await this.boostRepository.getCompetitionIdsBoostedDuringSeason(
          address,
          season.startDate,
          season.endDate,
        );
    }

    // Get competition IDs where user's agents competed during the season
    let competedCompetitionIds: string[] = [];
    if (this.competitionRepository) {
      competedCompetitionIds =
        await this.competitionRepository.getCompetitionIdsCompetedDuringSeason(
          address,
          season.startDate,
          season.endDate,
        );
    }

    // Calculate total unique competitions (union of boosted and competed)
    const allCompetitionIds = new Set([
      ...boostedCompetitionIds,
      ...competedCompetitionIds,
    ]);
    const totalUniqueCompetitions = allCompetitionIds.size;

    return {
      hasBoostedAgents: boostedCompetitionIds.length > 0,
      hasCompetedInCompetitions: competedCompetitionIds.length > 0,
      boostedCompetitionIds,
      competedCompetitionIds,
      totalUniqueCompetitions,
    };
  }
}
