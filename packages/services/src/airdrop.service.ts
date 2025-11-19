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
  ineligibleAmount: bigint;
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
          const daysToAdd = season.number > 0 ? 30 : 90;
          const expirationTimestamp = new Date(season.startDate);
          expirationTimestamp.setDate(
            expirationTimestamp.getDate() + daysToAdd,
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
}
