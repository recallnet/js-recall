import { Logger } from "pino";

import { AirdropRepository } from "@recallnet/db/repositories/airdrop";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";
import { Season } from "@recallnet/db/schema/airdrop/types";

export type BaseClaim = {
  season: number;
  seasonName: string;
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
 * Minimum number of distinct competitions required for eligibility
 */
export const MIN_COMPETITIONS_FOR_ELIGIBILITY = 3;

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
 * Full eligibility data for next season conviction rewards
 */
export interface NextSeasonEligibility {
  isEligible: boolean;
  season: number;
  seasonName: string;
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

  constructor(
    airdropRepository: AirdropRepository,
    logger: Logger,
    convictionClaimsRepository: ConvictionClaimsRepository,
    boostRepository?: BoostRepository,
    competitionRepository?: CompetitionRepository,
  ) {
    this.airdropRepository = airdropRepository;
    this.convictionClaimsRepository = convictionClaimsRepository;
    this.boostRepository = boostRepository!;
    this.competitionRepository = competitionRepository!;
    this.logger = logger;
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
   * Get all airdrop claims data for an account across all seasons
   */
  async getAccountClaimsData(address: string): Promise<ClaimData[]> {
    try {
      this.logger.info(`Fetching claims data for address: ${address}`);

      const seasons = await this.airdropRepository.getSeasons();
      const seasonsByNumber = seasons.reduce(
        (acc, season) => {
          acc[season.number] = season;
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
          (cc) => cc.season === allocation.season,
        );

        const season = seasonsByNumber[allocation.season];
        if (!season) {
          throw new Error(
            `Season ${allocation.season} not found for allocation`,
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
            season: allocation.season,
            seasonName: season.name,
            ineligibleReason,
            ineligibleAmount: allocation.ineligibleReward || 0n,
          };
        } else if (!convictionClaim) {
          // Determine if the claim has expired
          // Use UTC-safe date arithmetic to avoid DST issues
          const daysToAdd = season.number > 0 ? 30 : 90;
          const expirationTimestamp = new Date(
            season.startDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000,
          );
          const now = new Date();
          const expired = now > expirationTimestamp;

          if (expired) {
            return {
              type: "expired",
              season: allocation.season,
              seasonName: season.name,
              eligibleAmount: allocation.amount,
              expiredAt: expirationTimestamp,
            };
          }
          return {
            type: "available",
            season: allocation.season,
            seasonName: season.name,
            eligibleAmount: allocation.amount,
            expiresAt: expirationTimestamp,
            proof: allocation.season > 0 ? allocation.proof : [],
          };
        } else if (convictionClaim.duration > 0n) {
          return {
            type: "claimed-and-staked",
            season: allocation.season,
            seasonName: season.name,
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
            season: allocation.season,
            seasonName: season.name,
            eligibleAmount: convictionClaim.eligibleAmount,
            claimedAmount: convictionClaim.claimedAmount,
            claimedAt: convictionClaim.blockTimestamp,
          };
        } else {
          // This should be unreachable if all conditions are properly handled
          throw new Error(
            `Unexpected state for allocation: season=${allocation.season}, ` +
              `hasEndDate=${!!season.endDate}, hasConvictionClaim=${!!convictionClaim}, ` +
              `ineligibleReason=${ineligibleReason}`,
          );
        }
      });

      // Sort by season (most recent first)
      claimsData.sort((a, b) => b.season - a.season);

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
   * Get eligibility data for next season conviction rewards.
   *
   * Calculates whether an address is eligible for conviction rewards based on:
   * - Having active stakes (conviction claims with duration > 0 extending past season end)
   * - Participating in at least 3 distinct competitions (boosting OR competing combined)
   *
   * @param address - The wallet address to check
   * @param seasonNumber - Optional specific season to check, defaults to next season
   * @returns Full eligibility data including potential reward and pool statistics
   */
  async getNextSeasonEligibility(
    address: string,
    seasonNumber?: number,
  ): Promise<NextSeasonEligibility> {
    try {
      const normalizedAddress = address.toLowerCase();
      this.logger.info(
        `Calculating next season eligibility for address: ${normalizedAddress}`,
      );

      // Get all seasons to determine the target season
      const seasons = await this.airdropRepository.getSeasons();
      const sortedSeasons = seasons.sort((a, b) => b.number - a.number);

      // Determine target season
      let targetSeason: Season;
      if (seasonNumber !== undefined) {
        const found = seasons.find((s) => s.number === seasonNumber);
        if (!found) {
          throw new Error(`Season ${seasonNumber} not found`);
        }
        targetSeason = found;
      } else {
        // Default to next season (latest season number + 1)
        const latestSeason = sortedSeasons[0];
        if (!latestSeason) {
          throw new Error("No seasons found in database");
        }
        // For next season, we use the current/latest season's data
        // The "next season" rewards are calculated based on activity in the current season
        targetSeason = latestSeason;
      }

      // For eligibility calculation, we need the current season (one before the target)
      const currentSeasonNumber =
        seasonNumber !== undefined ? seasonNumber - 1 : targetSeason.number;
      const currentSeason = seasons.find(
        (s) => s.number === currentSeasonNumber,
      );
      if (!currentSeason) {
        throw new Error(`Current season ${currentSeasonNumber} not found`);
      }

      const targetSeasonNumber = currentSeasonNumber + 1;
      const targetSeasonData = seasons.find(
        (s) => s.number === targetSeasonNumber,
      );

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

      // User is eligible if they have active stakes AND participated in at least 3 competitions
      const hasActivityEligibility =
        eligibilityReasons.totalUniqueCompetitions >=
        MIN_COMPETITIONS_FOR_ELIGIBILITY;
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

      const result: NextSeasonEligibility = {
        isEligible,
        season: targetSeasonNumber,
        seasonName: targetSeasonData?.name || `Season ${targetSeasonNumber}`,
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
          season: targetSeasonNumber,
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
        season.number,
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
