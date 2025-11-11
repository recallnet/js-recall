import { Logger } from "pino";

import { AirdropRepository } from "@recallnet/db/repositories/airdrop";
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
};

export type ClaimData =
  | AvailableClaim
  | ClaimedAndStakedClaim
  | ClaimedAndNotStakedClaim
  | ExpiredClaim
  | IneligibleClaim;

export class AirdropService {
  private readonly airdropRepository: AirdropRepository;
  private readonly convictionClaimsRepository: ConvictionClaimsRepository;
  private readonly logger: Logger;

  constructor(
    airdropRepository: AirdropRepository,
    logger: Logger,
    convictionClaimsRepository: ConvictionClaimsRepository,
  ) {
    this.airdropRepository = airdropRepository;
    this.convictionClaimsRepository = convictionClaimsRepository;
    this.logger = logger;
  }

  /**
   * Calculate unlock date for staked tokens
   */
  private calculateUnlockDate(
    claimTimestamp: Date,
    durationInSeconds: bigint,
  ): Date {
    const unlockTime = new Date(claimTimestamp);
    unlockTime.setSeconds(unlockTime.getSeconds() + Number(durationInSeconds));
    return unlockTime;
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

        const followingSeason = seasonsByNumber[allocation.season + 1];

        const ineligibleReason =
          allocation.sybilClassification !== "approved"
            ? allocation.flaggingReason || "Sybil flagged"
            : allocation.flaggingReason
              ? allocation.flaggingReason
              : undefined;

        if (ineligibleReason) {
          return {
            type: "ineligible",
            season: allocation.season,
            seasonName: season.name,
            ineligibleReason,
          };
        } else if (!convictionClaim) {
          // Determine if the claim has expired
          const now = new Date();
          let expiredAt: Date | null = null;

          if (followingSeason?.endDate && followingSeason.endDate < now) {
            // Following season has ended, so claim is expired
            expiredAt = followingSeason.endDate;
          } else if (!followingSeason && season.endDate) {
            // No following season and current season has ended
            const potentialExpiry = new Date(season.endDate);
            potentialExpiry.setDate(potentialExpiry.getDate() + 30);
            if (potentialExpiry < now) {
              expiredAt = potentialExpiry;
            }
          }

          if (expiredAt) {
            return {
              type: "expired",
              season: allocation.season,
              seasonName: season.name,
              eligibleAmount: allocation.amount,
              expiredAt,
            };
          }

          // Claim is still available
          // Calculate expiry date:
          // - If following season exists and has ended, use its end date
          // - If season has ended but no following season, add 30 days to season end
          // - If season is still active, add 60 days to season start (30 day season + 30 day claim window)
          const expiresAt = followingSeason?.endDate
            ? followingSeason.endDate
            : (() => {
                const baseDate = season.endDate || season.startDate;
                const daysToAdd = season.endDate ? 30 : 60;
                const date = new Date(baseDate);
                date.setDate(date.getDate() + daysToAdd);
                return date;
              })();
          return {
            type: "available",
            season: allocation.season,
            seasonName: season.name,
            eligibleAmount: allocation.amount,
            expiresAt,
            proof: allocation.proof,
          };
        } else if (convictionClaim.duration > 0n) {
          return {
            type: "claimed-and-staked",
            season: allocation.season,
            seasonName: season.name,
            eligibleAmount: convictionClaim.eligibleAmount,
            claimedAmount: convictionClaim.claimedAmount,
            stakeDuration: Number(convictionClaim.duration),
            claimedAt: convictionClaim.createdAt,
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
            claimedAt: convictionClaim.createdAt,
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
        `Error fetching claims data for address ${address}:`,
        error,
      );
      throw error;
    }
  }
}
