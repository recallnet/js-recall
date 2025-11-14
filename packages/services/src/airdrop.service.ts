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

        const season = seasonsByNumber[allocation.season]!;

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
        } else if (season.endDate && !convictionClaim) {
          return {
            type: "expired",
            season: allocation.season,
            seasonName: season.name,
            eligibleAmount: allocation.amount,
            expiredAt: season.endDate,
          };
        } else if (!season.endDate && !convictionClaim && !ineligibleReason) {
          const expiresAt = new Date();
          expiresAt.setDate(season.startDate.getDate() + 30);
          return {
            type: "available",
            season: allocation.season,
            seasonName: season.name,
            eligibleAmount: allocation.amount,
            expiresAt,
            proof: allocation.proof,
          };
        } else if (convictionClaim && convictionClaim.duration > 0n) {
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
        } else if (convictionClaim && convictionClaim.duration === 0n) {
          return {
            type: "claimed-and-not-staked",
            season: allocation.season,
            seasonName: season.name,
            eligibleAmount: convictionClaim.eligibleAmount,
            claimedAmount: convictionClaim.claimedAmount,
            claimedAt: convictionClaim.createdAt,
          };
        } else {
          throw new Error("Invalid season data");
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

  // Keep the existing checkEligibility method for backward compatibility
  async checkEligibility(address: string, season: number) {
    // TODO: Whatever checks we want to do.
    // No idea if/how season fits in here.
    console.log(`season is ${season}, address is ${address}`); // log to fix lint
    const res = await this.airdropRepository.getAllocationByAddress(address);
    return res;
  }
}
